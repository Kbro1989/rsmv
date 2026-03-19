"use strict";
//from npm yieldparser
Object.defineProperty(exports, "__esModule", { value: true });
exports.parse = parse;
exports.mustEnd = mustEnd;
exports.isEnd = isEnd;
exports.hasMore = hasMore;
exports.has = has;
exports.optional = optional;
exports.lookAhead = lookAhead;
exports.invert = invert;
function parse(input, iterable) {
    let lastResult;
    let iterationCount = -1;
    const iterator = iterable[Symbol.iterator]();
    main: while (true) {
        const nestedErrors = [];
        iterationCount += 1;
        const next = iterator.next(lastResult);
        if (next.done) {
            if (next.value instanceof Error) {
                return {
                    success: false,
                    remaining: input,
                    failedOn: {
                        iterationCount,
                        yielded: next.value,
                    },
                };
            }
            return {
                success: true,
                remaining: input,
                result: next.value,
            };
        }
        const yielded = next.value;
        const choices = typeof yielded !== "string" && yielded[Symbol.iterator]
            ? yielded
            : [yielded];
        for (const choice of choices) {
            if (typeof choice === "string") {
                let found = false;
                const newInput = input.replace(choice, (_1, offset) => {
                    found = offset === 0;
                    return "";
                });
                if (found) {
                    input = newInput;
                    lastResult = choice;
                    continue main;
                }
            }
            else if (choice instanceof RegExp) {
                if (["^", "$"].includes(choice.source[0]) === false) {
                    throw new Error(`Regex must be from start: ${choice}`);
                }
                const match = input.match(choice);
                if (match) {
                    lastResult = match;
                    // input = input.replace(item, '');
                    input = input.slice(match[0].length);
                    continue main;
                }
            }
            else if (choice instanceof Function) {
                const choiceResult = parse(input, choice());
                if (choiceResult.success) {
                    lastResult = choiceResult.result;
                    input = choiceResult.remaining;
                    continue main;
                }
                else if (choiceResult.failedOn) {
                    nestedErrors.push(choiceResult.failedOn);
                    // if (choiceResult.failedOn.iterationCount > 0) {
                    //   return {
                    //     success: false,
                    //     remaining: input,
                    //     failedOn: {
                    //       iterationCount,
                    //       yielded: choice,
                    //       nested: nestedErrors.length === 0 ? undefined : nestedErrors,
                    //     },
                    //   };
                    // }
                }
            }
        }
        return {
            success: false,
            remaining: input,
            failedOn: {
                iterationCount,
                yielded,
                nested: nestedErrors.length === 0 ? undefined : nestedErrors,
            },
        };
    }
}
function* mustEnd() {
    yield /^$/;
}
function* isEnd() {
    const { index } = yield /$/;
    return index === 0;
}
function* hasMore() {
    const { index } = yield /$/;
    return index > 0;
    // return !(yield isEnd);
}
function has(prefix) {
    return function* () {
        return (yield [prefix, ""]) !== "";
    };
}
function optional(...potentials) {
    return function* () {
        const result = yield [...potentials, ""];
        return result === "" ? undefined : result;
    };
}
function lookAhead(regex) {
    const lookAheadRegex = new RegExp(`^(?=${regex.source})`);
    return function* () {
        return yield lookAheadRegex;
    };
}
////////
function invert(needle, iterable) {
    const result = invertInner(needle, iterable);
    if (result !== null && result.type === "done") {
        return result.components.join("");
    }
    return null;
}
function invertInner(needle, iterable) {
    let reply;
    const expectedKeys = Object.keys(needle);
    if (expectedKeys.length === 0) {
        throw new Error("Expected object must have keys.");
    }
    const iterator = iterable[Symbol.iterator]();
    const components = [];
    const regexpMap = new Map();
    while (true) {
        const next = iterator.next(reply);
        if (next.done) {
            if (next.value instanceof Error) {
                return null;
            }
            const result = next.value;
            if (result == null) {
                return { type: "prefix", components: Object.freeze(components) };
            }
            const resultKeys = new Set(Object.keys(result));
            if (expectedKeys.length === resultKeys.size &&
                expectedKeys.every((key) => {
                    if (!resultKeys.has(key)) {
                        return false;
                    }
                    if (typeof result[key] === "symbol") {
                        const entry = regexpMap.get(result[key]);
                        if (entry !== undefined) {
                            if (entry.regexp.test(needle[key])) {
                                components[entry.index] = needle[key];
                                return true;
                            }
                        }
                    }
                    return result[key] === needle[key];
                })) {
                return { type: "done", components: Object.freeze(components) };
            }
            else {
                return null;
            }
        }
        const yielded = next.value;
        const choices = typeof yielded !== "string" && yielded[Symbol.iterator]
            ? yielded
            : [yielded];
        for (const choice of choices) {
            reply = undefined;
            if (typeof choice === "string") {
                components.push(choice);
                reply = choice;
                break; // Assume first string is the canonical version.
            }
            else if (choice instanceof RegExp) {
                const index = components.length;
                components.push(""); // This will be replaced later using the index.
                // components.push('???'); // This will be replaced later using the index.
                const s = Symbol();
                regexpMap.set(s, { regexp: choice, index });
                reply = [s];
            }
            else if (choice instanceof Function) {
                const result = invertInner(needle, choice());
                if (result != null) {
                    if (result.type === "done") {
                        return {
                            type: "done",
                            components: Object.freeze(components.concat(result.components)),
                        };
                    }
                    else {
                        components.push(...result.components);
                    }
                }
            }
        }
    }
}
// type CustomFunc<T> = (p: Parser) => T;
// interface MatcherFunc {
//   (s: string): string;
//   (r: RegExp): [string];
//   <T>(c: CustomFunc<T>): T;
// }
// type Parser = MatcherFunc & {
//   peek: MatcherFunc;
//   error(description: string): void;
// };
// function Digit(this: Parser): number {
//   const [digits] = this(/^\d+$/);
//   const value = parseInt(digits, 10);
//   if (value < 0 || value > 255) {
//     this.error(`value must be between 0 and 255, was ${value}`);
//   }
//   return value;
// }
// function IPAddress(this: Parser): [number, number, number, number] {
//   const first = this(Digit);
//   this(".");
//   const second = this(Digit);
//   this(".");
//   const third = this(Digit);
//   this(".");
//   const fourth = this(Digit);
//   return [first, second, third, fourth];
// }
