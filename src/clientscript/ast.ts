import { clientscript } from "../../generated/clientscript";
import { clientscriptdata } from "../../generated/clientscriptdata";
import type { ClientscriptObfuscation, OpcodeInfo } from "./callibrator";
import { debugAst } from "./codewriter";
import { branchInstructions, branchInstructionsOrJump, dynamicOps, typeToPrimitive, namedClientScriptOps, variableSources, StackDiff, StackInOut, StackList, StackTypeExt, ClientScriptOp, StackConst, StackType, StackConstants, getParamOps, subtypes, branchInstructionsInt, branchInstructionsLong, ExactStack, dependencyGroup, dependencyIndex, typeuuids, getOpName, makeop, getArgType, getReturnType } from "./definitions";
import { OpcodeWriterContext, intrinsics } from "./jsonwriter";
import { ClientScriptSubtypeSolver } from "./subtypedetector";
export {
    AstNode, SubcallNode, ComposedOp, VarAssignNode, CodeBlockNode, BranchingStatement,
    WhileLoopStatementNode, ControlStatementNode, SwitchStatementNode, IfStatementNode,
    FunctionBindNode, RawOpcodeNode, RewriteCursor, ClientScriptFunction,
    getSingleChild, isNamedOp, getNodeStackOut, getNodeStackIn, varArgtype, retargetJumps
} from "./ast_nodes";

import {
    AstNode, SubcallNode, ComposedOp, VarAssignNode, CodeBlockNode, BranchingStatement,
    WhileLoopStatementNode, ControlStatementNode, SwitchStatementNode, IfStatementNode,
    FunctionBindNode, RawOpcodeNode, RewriteCursor, ClientScriptFunction,
    getSingleChild, isNamedOp, getNodeStackOut, getNodeStackIn, varArgtype, retargetJumps
} from "./ast_nodes";

/**
 * known issues
 * - If all branches (and default) of a switch statement return, then the last branch is emptied and its contents are placed after the end of the block (technically still correct)
 *   - has to do with the way the branching detection works (AstNode.findNext)
 * - some op arguments still not figured out
 * - none of this is tested for older builds
 *   - probably breaks at the build where pushconst ops were merged (~700?)
 */

export function translateAst(ast: CodeBlockNode) {
    let cursor = new RewriteCursor(ast);

    //remove 0 offset jumps, is a noop
    for (let i = 0; i < ast.children.length; i++) {
        let op = ast.children[i];
        if (isNamedOp(op, namedClientScriptOps.jump) && op.op.imm == 0) {
            ast.children.splice(i, 1);
            i--;
        }
    }
    //detect x++ and variants
    for (let i = 0; i < ast.children.length - 3; i++) {
        let prepushx = ast.children[i - 1];
        let pushx = ast.children[i];
        let push1 = ast.children[i + 1];
        let plusminus = ast.children[i + 2];
        let popx = ast.children[i + 3];
        let postpushx = ast.children[i + 4];
        if (
            isNamedOp(pushx, namedClientScriptOps.pushlocalint) &&
            isNamedOp(push1, namedClientScriptOps.pushconst) &&
            (isNamedOp(plusminus, namedClientScriptOps.plus) || isNamedOp(plusminus, namedClientScriptOps.minus)) &&
            isNamedOp(popx, namedClientScriptOps.poplocalint) &&
            pushx.op.imm == popx.op.imm
        ) {
            let isminus = plusminus.op.opcode == namedClientScriptOps.minus;
            let ispre = isNamedOp(prepushx, namedClientScriptOps.pushlocalint) && prepushx.op.imm == popx.op.imm;
            let ispost = !ispre && isNamedOp(postpushx, namedClientScriptOps.pushlocalint) && postpushx.op.imm == popx.op.imm;
            if (ispre || ispost) {
                let op = new ComposedOp(popx.originalindex, (isminus ? (ispre ? "x--" : "--x") : (ispre ? "x++" : "++x")));
                ast.remove(pushx);
                ast.remove(push1);
                ast.remove(plusminus);
                ast.replaceChild(popx, op);

                op.internalOps.push(pushx);
                op.internalOps.push(push1);
                op.internalOps.push(plusminus);
                op.internalOps.push(popx);
                if (ispre) {
                    ast.remove(prepushx);
                    op.internalOps.unshift(prepushx);
                } else {
                    ast.remove(postpushx);
                    op.internalOps.push(postpushx);
                }
                op.knownStackDiff = StackInOut.fromExact([], [subtypes.int]);
            }
        }
    }

    //merge variable assign nodes
    let currentassignnode: VarAssignNode | null = null;
    for (let node = cursor.goToStart(); node; node = cursor.next()) {
        if (node instanceof RawOpcodeNode && (
            node.op.opcode == namedClientScriptOps.poplocalint ||
            node.op.opcode == namedClientScriptOps.poplocallong ||
            node.op.opcode == namedClientScriptOps.poplocalstring ||
            node.op.opcode == namedClientScriptOps.popvar ||
            node.op.opcode == namedClientScriptOps.popvarbit ||
            node.op.opcode == namedClientScriptOps.popdiscardint ||
            node.op.opcode == namedClientScriptOps.popdiscardlong ||
            node.op.opcode == namedClientScriptOps.popdiscardstring
        )) {
            if (currentassignnode && currentassignnode.parent != node.parent) {
                throw new Error("ast is expected to be flat at this stage");
            }
            if (!currentassignnode) {
                currentassignnode = new VarAssignNode(node.originalindex);
                cursor.replaceNode(currentassignnode);
            } else {
                cursor.remove();
            }
            currentassignnode.addVar(node);
        } else {
            currentassignnode = null;
        }
    }

    let expandNode = (node: AstNode) => {
        if (!(node instanceof ComposedOp) && !(node instanceof CodeBlockNode)) {
            let argtype = getNodeStackIn(node).clone();
            for (let i = node.children.length - 1; i >= 0; i--) {
                argtype.pop(getNodeStackOut(node.children[i]));
            }
            while (!argtype.isEmpty() && usablestackdata.length != 0) {
                let { stackel, stackconst } = usablestackdata.at(-1)!;
                let outtype = getNodeStackOut(stackel);
                if (argtype.hasSimple(bindargs)) {
                    if (typeof stackconst != "string") { throw new Error("expected vararg string"); }
                    usablestackdata.pop();
                    let bindnode: FunctionBindNode;
                    if (outtype.values.length == 1 && outtype.values[0] == "vararg") {
                        if (!stackel.knownStackDiff) { throw new Error("unexpected"); }
                        bindnode = new FunctionBindNode(stackel.originalindex, stackel.knownStackDiff.in);
                        bindnode.pushList(stackel.children);
                    } else {
                        let maybearraylen = usablestackdata.at(-1)?.stackconst;
                        let args = varArgtype(stackconst, maybearraylen);
                        if (!args) { throw new Error("vararg const string expected"); }
                        bindnode = new FunctionBindNode(stackel.originalindex, args);
                    }
                    expandNode(bindnode);
                    stackel.parent!.replaceChild(stackel, bindnode);

                    outtype = getNodeStackOut(bindnode);
                    stackel = bindnode;
                }
                if (outtype.isEmpty() || argtype.tryPop(outtype) != 0) { break; }
                node.unshift(stackel);
                usablestackdata.pop();
            }
            if (!argtype.isEmpty()) {
                node.unshift(new ComposedOp(node.originalindex, "stack"));
            }
        }

        //update usable stack data
        let outtype = getNodeStackOut(node);
        if (outtype.isEmpty()) {
            //if usablestack is not empty is means that there are unused values on stack, indicate that these ops have unused values
            usablestackdata.forEach(({ stackel }) => {
                //indicate that the previous op pushes something to stack
                let capnode = new ComposedOp(stackel.originalindex, "stack");
                if (!stackel.parent) { throw new Error("uncapped node without parent"); }
                stackel.parent.replaceChild(stackel, capnode);
                capnode.push(stackel);
            });
            usablestackdata.length = 0;
        } else {
            usablestackdata.push({ stackel: node, stackconst: node.knownStackDiff?.constout ?? null });
        }
    }

    //find call arguments
    let bindargs = new StackList(["int", "vararg"]);
    let usablestackdata: { stackel: AstNode, stackconst: StackConst }[] = [];
    for (let node = cursor.goToStart(); node; node = cursor.next()) {
        expandNode(node);
    }
    return ast;
}
function fixControlFlow(ast: AstNode, scriptjson: clientscript) {
    let cursor = new RewriteCursor(ast);
    //find if statements
    oploop: for (let node = cursor.goToStart(); node; node = cursor.next()) {
        if (node instanceof IfStatementNode) {
            //detect an or statement that wasn't caught before (a bit late, there should be a better way to do this)
            let falseif = getSingleChild(node.falsebranch, IfStatementNode);
            if (falseif && falseif.truebranch == node.truebranch) {
                let combined = new BranchingStatement({ opcode: namedClientScriptOps.shorting_or, imm: 0, imm_obj: null }, node.statement.originalindex);
                combined.push(node.statement);
                combined.push(falseif.statement);
                node.setBranches(combined, node.truebranch, falseif.falsebranch, falseif.ifEndIndex);
            }
            let trueif = getSingleChild(node.truebranch, IfStatementNode);
            if (trueif && trueif.falsebranch == node.falsebranch) {
                let combined = new BranchingStatement({ opcode: namedClientScriptOps.shorting_and, imm: 0, imm_obj: null }, node.statement.originalindex);
                combined.push(node.statement);
                combined.push(trueif.statement);
                node.setBranches(combined, trueif.truebranch, trueif.falsebranch, node.ifEndIndex);
            }
        }
        if (node instanceof RawOpcodeNode && branchInstructions.includes(node.opinfo.id)) {
            let parent = node.parent;
            if (!(parent instanceof CodeBlockNode) || parent.possibleSuccessors.length != 2) { throw new Error("if op parent is not compatible"); }
            if (parent.children.at(-1) != node) { throw new Error("if op is not last op in codeblock"); }
            if (!parent.branchEndNode) { throw new Error("if statement parent end node expected"); }

            let trueblock = parent.possibleSuccessors[1];
            let falseblock: CodeBlockNode | null = parent.possibleSuccessors[0];
            let originalFalseblock = falseblock;
            let falseblockjump = getSingleChild(falseblock, RawOpcodeNode);
            if (falseblockjump && falseblockjump.opinfo.id == namedClientScriptOps.jump) {
                if (falseblock.possibleSuccessors.length != 1) { throw new Error("jump successor branch expected"); }
                falseblock = falseblock.possibleSuccessors[0];
                if (falseblock == parent.branchEndNode) {
                    falseblock = null;
                }
            }
            if (trueblock == parent.branchEndNode) {
                //empty true branch
                trueblock = new CodeBlockNode(trueblock.scriptid, trueblock.subfuncid, trueblock.originalindex);
            }
            if (!(trueblock instanceof CodeBlockNode)) { throw new Error("true branch isn't a codeblock"); }
            if (falseblock && !(falseblock instanceof CodeBlockNode)) { throw new Error("false branch exists but is not a codeblock"); }

            //wrap loopable block with another codeblock
            if (trueblock.lastPointer) {
                let newblock = new CodeBlockNode(trueblock.scriptid, trueblock.subfuncid, trueblock.originalindex);
                newblock.mergeBlock(trueblock, false);
                newblock.maxEndIndex = trueblock.maxEndIndex;
                trueblock = newblock;
            }
            if (falseblock && falseblock.lastPointer) {
                let newblock = new CodeBlockNode(falseblock.scriptid, trueblock.subfuncid, falseblock.originalindex);
                newblock.mergeBlock(falseblock, false);
                newblock.maxEndIndex = falseblock.maxEndIndex;
                falseblock = newblock;
            }

            let condnode = new BranchingStatement(node.op, node.originalindex);
            condnode.pushList(node.children);

            let grandparent = parent?.parent;
            if (parent instanceof CodeBlockNode && grandparent instanceof IfStatementNode && grandparent.ifEndIndex == parent.branchEndNode.originalindex) {
                let equaltrue = grandparent.truebranch == trueblock;
                let equalfalse = grandparent.falsebranch == falseblock || grandparent.falsebranch == originalFalseblock;
                let isor = equaltrue && grandparent.falsebranch == parent;
                let isand = equalfalse && grandparent.truebranch == parent && parent.children.length == 1;
                if (isor || isand) {
                    parent.remove(node);
                    //TODO make some sort of in-line codeblock node for this
                    // console.log("merging if statements while 2nd if wasn't parsed completely, stack will be invalid");
                    while (parent.children.length != 0) {
                        condnode.unshift(parent.children[0]);
                    }
                    let fakeop: ClientScriptOp = { opcode: isor ? namedClientScriptOps.shorting_or : namedClientScriptOps.shorting_and, imm: 0, imm_obj: null };
                    let combinedcond = new BranchingStatement(fakeop, grandparent.originalindex);
                    combinedcond.push(grandparent.statement);
                    combinedcond.push(condnode);
                    if (isor) {
                        grandparent.setBranches(combinedcond, trueblock, falseblock, parent.branchEndNode.originalindex);
                    } else {
                        grandparent.setBranches(combinedcond, trueblock, falseblock, parent.branchEndNode.originalindex);
                    }
                    continue;
                }
            }

            let ifstatement = new IfStatementNode(condnode.originalindex);
            ifstatement.setBranches(condnode, trueblock, falseblock, parent.branchEndNode.originalindex);
            cursor.replaceNode(ifstatement);
            cursor.setFirstChild(ifstatement, true);
        }
        if (node instanceof RawOpcodeNode && node.opinfo.id == namedClientScriptOps.switch) {
            if (!(node.parent instanceof CodeBlockNode) || !node.parent.branchEndNode) { throw new Error("code block expected"); }
            let casestatement = SwitchStatementNode.create(node, scriptjson, node.parent.possibleSuccessors, node.parent.branchEndNode.originalindex);
            cursor.replaceNode(casestatement);
            cursor.setFirstChild(casestatement, true);
        }
        if (node instanceof RawOpcodeNode && node.opinfo.id == namedClientScriptOps.jump) {
            let target = node.originalindex + 1 + node.op.imm;
            let parent = node.parent;
            if (node.op.imm == 0) {
                //ignore 0 jump (used as noop by custom compiler)
            } else if (parent instanceof CodeBlockNode && parent.maxEndIndex == target) {
                //closing bracket jump, already handled
            } else {
                for (let ifnode = node.parent; ifnode; ifnode = ifnode.parent) {
                    if (ifnode instanceof IfStatementNode) {
                        let codeblock = ifnode.parent;
                        if (!(codeblock instanceof CodeBlockNode) || !codeblock.parent) { throw new Error("unexpected"); }
                        if (codeblock.originalindex != target) { continue; }
                        if (codeblock.children.at(-1) != ifnode) { throw new Error("unexpected"); }

                        //TODO this is silly, there might be more instructions in the enclosing block, make sure these aren't lost
                        for (let i = codeblock.children.length - 2; i >= 0; i--) {
                            ifnode.statement.unshift(codeblock.children[i]);
                        }
                        let originalparent = codeblock.parent;
                        let loopstatement = WhileLoopStatementNode.fromIfStatement(codeblock.originalindex, ifnode);
                        originalparent.replaceChild(codeblock, loopstatement);
                        cursor.rebuildStack();
                        cursor.remove();
                        continue oploop;
                    }
                }
            }
            cursor.remove();
            continue;
        }
        if (node instanceof CodeBlockNode && node.branchEndNode) {
            if (node.maxEndIndex == -1 || node.branchEndNode.originalindex < node.maxEndIndex) {
                let subnode = node.branchEndNode;
                cursor.prev();
                if (subnode.lastPointer) {
                    node.mergeBlock(subnode, false);
                } else {
                    node.mergeBlock(subnode, true);
                }
            }
        }
    }
}

export function setRawOpcodeStackDiff(consts: StackConstants | null, calli: ClientscriptObfuscation, node: RawOpcodeNode) {
    if (branchInstructionsInt.includes(node.opinfo.id)) {
        //make sure that left and right side are same type
        let uuid = typeuuids.int++;
        node.knownStackDiff = StackInOut.fromExact([uuid, uuid], []);
    } else if (branchInstructionsLong.includes(node.opinfo.id)) {
        //make sure that left and right side are same type
        let uuid = typeuuids.long++;
        node.knownStackDiff = StackInOut.fromExact([uuid, uuid], []);
    } else if (node.opinfo.id == namedClientScriptOps.dbrow_getfield) {
        //args are rowid,tablefield,subrow
        let tablefield = consts?.values.at(-2);
        if (typeof tablefield == "number") {
            let dbtable = (tablefield >> 12) & 0xffff;
            let columnid = (tablefield >> 4) & 0xff;
            let subfield = tablefield & 0xf;
            let table = calli.dbtables.get(dbtable);
            let column = table?.unk01?.columndata.find(q => q.id == columnid) ?? table?.unk02?.columndata.find(q => q.id == columnid);
            if (column) {
                node.knownStackDiff = StackInOut.fromExact(
                    [subtypes.dbrow, subtypes.int, subtypes.int],
                    (subfield != 0 ? [column.columns[subfield - 1].type] : column.columns.map(q => q.type))
                )
            }
        }
    } else if (getParamOps.includes(node.opinfo.id)) {
        //args are structid/itemid,paramid
        let paramid = consts?.values.at(-1);
        if (typeof paramid == "number") {
            let param = calli.parammeta.get(paramid);
            if (!param) {
                console.log("unknown param " + paramid);
            } else {
                let outtype = [param.type ? param.type.vartype : 0]
                let inputs = new StackList();
                //all getparams except for cc_getparam require a target
                if (node.opinfo.id != namedClientScriptOps.cc_getparam) { inputs.pushone("int"); }
                inputs.pushone("int");
                node.knownStackDiff = new StackInOut(inputs, new StackList(outtype.map(typeToPrimitive)));
                //don't set in type because it's probably different eg pointer to npc etc
                node.knownStackDiff.exactout = ExactStack.fromList(outtype);
            }
        }
    } else if (node.opinfo.id == namedClientScriptOps.enum_getvalue) {
        //args are intypeid,outtypeid,enum,lookup
        let outtypeid = consts?.values.at(-3);
        let intypeid = consts?.values.at(-4);
        if (typeof outtypeid == "number" && typeof intypeid == "number") {
            node.knownStackDiff = StackInOut.fromExact(
                [subtypes.int, subtypes.int, subtypes.enum, intypeid],
                [outtypeid],
            )
        }
    } else if (node.opinfo.id == namedClientScriptOps.return) {
        if (!node.knownStackDiff) {
            throw new Error("stackdiff or 'return' op should have been set at parser already");
        }
    } else if (node.opinfo.id == namedClientScriptOps.gosub) {
        let script = calli.scriptargs.get(node.op.imm);
        if (script) {
            node.knownStackDiff = script.stack;
        } else {
            //this can happen when callibration is incomplete
            node.knownStackDiff = new StackInOut();
        }
    } else if (node.opinfo.id == namedClientScriptOps.joinstring) {
        node.knownStackDiff = new StackInOut(
            new StackList(Array(node.op.imm).fill("string")),
            new StackList(["string"])
        )
    } else if (node.opinfo.id == namedClientScriptOps.pushvar || node.opinfo.id == namedClientScriptOps.popvar) {
        let varmeta = calli.getClientVarMeta(node.op.imm);
        if (varmeta) {
            let ispop = node.opinfo.id == namedClientScriptOps.popvar;

            let value = [varmeta.fulltype];
            node.knownStackDiff = StackInOut.fromExact(
                (ispop ? value : []),
                (ispop ? [] : value)
            );
        }
    } else if (node.opinfo.id == namedClientScriptOps.pushconst) {
        if (node.op.imm == 0) {
            if (typeof node.op.imm_obj != "number") { throw new Error("unexpected"); }
            node.knownStackDiff = StackInOut.fromExact([], [typeuuids.int++]);
            node.knownStackDiff.constout = node.op.imm_obj;
        } else if (node.op.imm == 1) {
            node.knownStackDiff = StackInOut.fromExact([], [typeuuids.long++]);
            node.knownStackDiff.constout = node.op.imm_obj;
        } else if (node.op.imm == 2) {
            let stringconst = node.op.imm_obj as string;
            node.knownStackDiff = StackInOut.fromExact([], [typeuuids.string++]);
            node.knownStackDiff.constout = node.op.imm_obj;

            //a string like this indicates a vararg set where this string indicates the types
            //treat the entire thing as one vararg
            //only make use of this construct if it is at least 3 chars long
            //otherwise ignore the equation
            let varargmatch = stringconst.match(/^([ils]*)Y?$/);
            if (consts && varargmatch && stringconst.length >= 3) {
                let argtype = varArgtype(stringconst, consts.values.at(-1));
                if (!argtype) { throw new Error("unexpected"); }
                node.knownStackDiff = new StackInOut(argtype, new StackList(["vararg"]));
                node.knownStackDiff.constout = node.op.imm_obj;
                node.knownStackDiff.exactin = ExactStack.fromList(argtype.toLooseSubtypes());
            } else if (varargmatch) {
                node.unknownstack = true;
            }
        } else {
            throw new Error("unexpected");
        }
    }

    if (!node.knownStackDiff && dynamicOps.includes(node.op.opcode)) {
        node.unknownstack = true;
    }
}

function addKnownStackDiff(children: AstNode[], calli: ClientscriptObfuscation) {
    let consts: StackConstants | null = new StackConstants();
    let hasunknown = false;

    for (let node of children) {
        let stackinout = node.knownStackDiff;
        if (node instanceof RawOpcodeNode) {
            setRawOpcodeStackDiff(consts, calli, node);
            stackinout ??= node.knownStackDiff ?? node.opinfo.stackinfo;
            hasunknown ||= node.unknownstack;
        } else if (node instanceof ClientScriptFunction) {
            //nop
        } else if (node instanceof SubcallNode) {
            //nop
        } else {
            throw new Error("unexpected");
        }

        if (consts) {
            if (node.knownStackDiff?.constout != null) {
                consts.pushOne(node.knownStackDiff.constout);
            } else if (stackinout?.initializedthrough) {
                consts.applyInOut(stackinout);
            } else {
                consts = null;
            }
        }
    }
    return hasunknown;
}

export function generateAst(calli: ClientscriptObfuscation, script: clientscriptdata | clientscript, ops: ClientScriptOp[], scriptid: number) {
    let getorMakeSection = (index: number, subfuncid: number) => {
        if (index >= ops.length) { throw new Error("tried to jump outside script"); }
        let section = sections.find(q => q.originalindex == index);
        if (!section) {
            section = new CodeBlockNode(scriptid, subfuncid, index);
            sections.push(section);
        }
        return section;
    }

    let parseSlice = (start: number, end: number, func: ClientScriptFunction, subfuncid: number) => {
        let currentsection = getorMakeSection(start, subfuncid);

        let localcounts = func.localCounts;
        subfuncs.push(func);

        //find all jump targets and make the sections
        for (let index = start; index < end; index++) {
            let op = ops[index];
            let info = calli.getNamedOp(op.opcode);

            if (branchInstructionsOrJump.includes(info.id)) {
                let nextindex = index + 1;
                let jumpindex = nextindex + op.imm;
                if (op.imm != 0 && jumpindex >= start && jumpindex < end) {
                    getorMakeSection(nextindex, subfuncid);
                    getorMakeSection(jumpindex, subfuncid);
                }
            }
        }

        //write the opcodes
        for (let index = start; index < end; index++) {
            let op = ops[index];
            let nextindex = index + 1;

            //update local var counts
            if (op.opcode == namedClientScriptOps.poplocalint || op.opcode == namedClientScriptOps.pushlocalint) { localcounts.int = Math.max(localcounts.int, op.imm + 1); }
            if (op.opcode == namedClientScriptOps.poplocallong || op.opcode == namedClientScriptOps.pushlocallong) { localcounts.long = Math.max(localcounts.long, op.imm + 1); }
            if (op.opcode == namedClientScriptOps.poplocalstring || op.opcode == namedClientScriptOps.pushlocalstring) { localcounts.string = Math.max(localcounts.string, op.imm + 1); }

            if (op.opcode == namedClientScriptOps.jump) {
                let target = index + 1 + op.imm;
                if (func && target == end) {
                    //jump to end of slice means subreturn
                    let opnode = new RawOpcodeNode(index, makeop(namedClientScriptOps.return), calli.getNamedOp(namedClientScriptOps.return));
                    opnode.knownStackDiff = new StackInOut(func.returntype, new StackList());
                    currentsection.push(opnode);
                    if (index != ops.length - 1) {
                        currentsection = getorMakeSection(nextindex, subfuncid);
                    }
                    continue;
                } else if (target < start || target > end) {
                    //see if we're jumping to a subfunction
                    let targetfn = subcalltargets.find(q => q.index == target);
                    if (targetfn) {
                        currentsection.push(new SubcallNode(index, targetfn.name, targetfn.in, targetfn.out));
                    } else {
                        throw new Error("couldn't find subcall function target");
                    }
                    continue;
                }
            }
            let info = calli.getNamedOp(op.opcode)!;
            let opnode = new RawOpcodeNode(index, op, info);

            //check if other flows merge into this one
            let addrsection = sections.find(q => q.originalindex == index);
            if (addrsection && addrsection != currentsection) {
                currentsection.addSuccessor(addrsection);
                currentsection = addrsection;
            }

            //add known stackdiff to 'return' op since it's context dependent
            if (opnode.op.opcode == namedClientScriptOps.return) {
                opnode.knownStackDiff = new StackInOut(getReturnType(calli, ops), new StackList());
            }

            currentsection.push(opnode);

            if (branchInstructionsOrJump.includes(info.id)) {
                let jumpindex = nextindex + op.imm;
                if (op.opcode == namedClientScriptOps.jump && jumpindex == index + 1) {
                    //ignore a 0 jump instruction (used as noop in custom compiler)
                } else {
                    let nextblock = getorMakeSection(nextindex, subfuncid);
                    let jumpblock = getorMakeSection(jumpindex, subfuncid);
                    if (info.id != namedClientScriptOps.jump) {
                        currentsection.addSuccessor(nextblock);
                    }
                    currentsection.addSuccessor(jumpblock);
                    currentsection = nextblock;
                }
            } else if (opnode.opinfo.id == namedClientScriptOps.return) {
                if (index != ops.length - 1) {
                    //dead code will be handled elsewhere
                    currentsection = getorMakeSection(nextindex, subfuncid);
                }
            } else if (opnode.opinfo.id == namedClientScriptOps.switch) {
                let cases = script.switches[opnode.op.imm];
                if (!cases) { throw new Error("no matching cases in script"); }

                for (let cond of cases) {
                    let jumpblock = getorMakeSection(nextindex + cond.jump, subfuncid);
                    if (!currentsection.possibleSuccessors.includes(jumpblock)) {
                        currentsection.addSuccessor(jumpblock);
                    }
                }
                let nextblock = getorMakeSection(nextindex, subfuncid);
                currentsection.addSuccessor(nextblock);
                currentsection = nextblock;
            }
        }
    }

    let rootfunc = new ClientScriptFunction(`script${scriptid == -1 ? "_unk" : scriptid}`, new StackList([getArgType(script)]), getReturnType(calli, ops), new StackDiff());
    let headersection = new CodeBlockNode(scriptid, -1, 0);

    let sections: CodeBlockNode[] = [];
    let subfuncs: ClientScriptFunction[] = [];
    let subcalltargets: { index: number, name: string, in: StackList, out: StackList }[] = [];
    let headerend = 0;

    let currentindex = 0;
    // if (ops.length >= currentindex + 2 && ops[currentindex].opcode == namedClientScriptOps.pushconst && ops[currentindex + 1].opcode == namedClientScriptOps.popdiscardstring) {
    //     let metadata = ops[currentindex].imm_obj;
    //     if (typeof metadata != "string") { throw new Error("unexpected"); }
    //     currentindex += 2;
    //     let match = metadata.match(/asd/);
    // }
    //jump at index 0 means there is a header section
    if (ops[currentindex].opcode == namedClientScriptOps.jump) {
        headerend = currentindex + ops[currentindex].imm + 1;
        currentindex++;
        let namecounter = 0;
        let parseQueue: Parameters<typeof parseSlice>[] = [];
        while (currentindex < headerend) {
            let op = ops[currentindex];
            if (op.opcode != namedClientScriptOps.pushconst || op.imm != 2 || typeof op.imm_obj != "string") {
                throw new Error("no header label text literal");
            }

            let values: Record<string, string> = {};
            for (let [, left, right] of op.imm_obj.matchAll(/(\S+)=(\S+)/g)) { values[left] = right; }

            let end = parseInt(values.end);
            let body = parseInt(values.body);
            let foot = parseInt(values.foot);
            let entry = parseInt(values.entry);
            let israwstack = values.rawstack == "true";
            let args = (values.in?.match(/^\d+,\d+,\d+$/) ? new StackDiff(...values.in.split(",").map(q => parseInt(q))) : new StackDiff());
            let returns = (values.out?.match(/^\d+,\d+,\d+$/) ? new StackDiff(...values.out.split(",").map(q => parseInt(q))) : new StackDiff());
            if (values.type == "returnjumps") {
                //noop, existance is implied
            } else if (values.type == "subfunc") {
                if (isNaN(end) || isNaN(body) || isNaN(foot) || isNaN(entry)) { throw new Error("invalid subfunc header"); }
                let returntype = getReturnType(calli, ops, currentindex + foot);
                if (!returns.equals(returntype.getStackdiff())) { throw new Error("detected subfunc return type not the same as declared return type"); }
                let subfuncid = namecounter++;
                let subfunc = new ClientScriptFunction(`subfunc_${subfuncid}`, new StackList([args]), returntype, new StackDiff());
                subfunc.isRawStack = israwstack;
                subfunc.originalindex = currentindex + entry;
                subcalltargets.push({ name: subfunc.scriptname, index: subfunc.originalindex, in: subfunc.argtype, out: subfunc.returntype });
                parseQueue.push([currentindex + body, currentindex + foot, subfunc, subfuncid]);
                //set the function body as empty code block with the actual body as successor, needed for control flow later on
                let entrynode = new CodeBlockNode(scriptid, subfuncid, currentindex + entry);
                entrynode.addSuccessor(getorMakeSection(currentindex + body, subfuncid));
                subfunc.push(entrynode);
            } else if (values.type == "intrinsic") {
                let name = values.name;
                if (typeof name != "string") { throw new Error("intrinsic name not set"); }
                let intrinsic = intrinsics.get(name);
                if (!intrinsic) { throw new Error(`intrinsic ${name} was references in bytecode, but does not exists in the version of rsmv`); }
                subcalltargets.push({ name, index: currentindex + entry, in: intrinsic.in, out: intrinsic.out });
            } else {
                console.log(`unknown header type "${values.type}"`);
            }
            if (isNaN(end)) { throw new Error("invalid subfunc header"); }
            currentindex += end;
        }

        parseQueue.forEach(q => parseSlice(...q));

        headersection.pushList(subfuncs);
        headersection.push(new RawOpcodeNode(0, ops[0], calli.getNamedOp(ops[0].opcode)!));
    }
    headersection.addSuccessor(getorMakeSection(headerend, -1));
    rootfunc.push(headersection);
    subfuncs.push(rootfunc);
    parseSlice(headerend, ops.length, rootfunc, -1);

    sections.sort((a, b) => a.originalindex - b.originalindex);
    sections.forEach(q => addKnownStackDiff(q.children, calli));

    subfuncs.forEach(q => {
        for (let node: CodeBlockNode | null = q.children[0] as CodeBlockNode | null; node; node = node.findNext());
    });

    return { sections, rootfunc, subfuncs };
}

function reattachDeadcode(sections: CodeBlockNode[]) {
    let reached = new Set<CodeBlockNode>([sections[0]]);
    for (let item of reached) {
        for (let suc of item.possibleSuccessors) {
            if (!reached.has(suc)) {
                reached.add(suc);
            }
        }
    }
    for (let i = 1; i < sections.length; i++) {
        let sec = sections[i];
        if (!reached.has(sec)) {
            sections[i - 1].deadcodeSuccessor = sec;
        }
    }
}

export function parseClientScriptIm(calli: ClientscriptObfuscation, script: clientscript, fileid = -1) {
    let { sections, rootfunc } = generateAst(calli, script, script.opcodedata, fileid);
    // reattachDeadcode(sections);
    let typectx = new ClientScriptSubtypeSolver();
    typectx.parseSections(sections);
    typectx.addKnownFromCalli(calli);
    typectx.solve();
    sections.forEach(translateAst);
    fixControlFlow(rootfunc.children[0], script);
    return { rootfunc, sections, typectx };
}
globalThis.parseClientScriptIm = parseClientScriptIm;
