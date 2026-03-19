"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.mountBakedSkeleton = mountBakedSkeleton;
exports.parseAnimationSequence4 = parseAnimationSequence4;
exports.getFrameClips = getFrameClips;
const utils_1 = require("../utils");
const constants_1 = require("../constants");
const opdecoder_1 = require("../opdecoder");
const three_1 = require("three");
const rt7model_1 = require("./rt7model");
function mountBakedSkeleton(rootnode, model) {
    let centers = (0, rt7model_1.getBoneCenters)(model);
    let rootbone = new three_1.Bone();
    rootnode.add(rootbone);
    let leafbones = [rootbone];
    let rootbones = [];
    let inverses = [new three_1.Matrix4()];
    for (let i = 1; i < model.bonecount; i++) {
        let rootbone = new three_1.Bone();
        let leafbone = new three_1.Bone();
        rootbone.name = `root_${i}`;
        leafbone.name = `bone_${i}`;
        rootbone.add(leafbone);
        rootbones.push(rootbone);
        leafbones.push(leafbone);
        let inverse = new three_1.Matrix4();
        let center = centers[i];
        if (center && center.weightsum != 0) {
            rootbone.position.set(center.xsum / center.weightsum, center.ysum / center.weightsum, center.zsum / center.weightsum);
            inverse.setPosition(rootbone.position);
        }
        inverse.invert();
        inverses.push(inverse);
    }
    let skeleton = new three_1.Skeleton(leafbones, inverses);
    if (rootbones.length != 0) {
        rootbone.add(...rootbones);
    }
    rootbone.updateMatrixWorld(true);
    let childbind = new three_1.Matrix4().copy(rootbone.matrixWorld);
    //TODO find out whats wrong with my own inverses
    skeleton.calculateInverses();
    rootnode.traverse(node => {
        if (node instanceof three_1.SkinnedMesh) {
            node.bind(skeleton, childbind);
            let geo = node.geometry;
            geo.attributes.skinIndex = geo.attributes.RA_skinIndex_bone;
            geo.attributes.skinWeight = geo.attributes.RA_skinWeight_bone;
        }
    });
    let mixer = new three_1.AnimationMixer(rootnode);
    return { mixer };
}
async function parseAnimationSequence4(loader, sequenceframes) {
    let secframe0 = sequenceframes[0];
    if (!secframe0) {
        throw new Error("animation has no frames");
    }
    let framearch = await loader.engine.getArchiveById(constants_1.cacheMajors.frames, secframe0.frameidhi);
    //some animations seem to use index instead of id, this seems to fix anim on npc 182
    // let frames = Object.fromEntries(framearch.map((q, i) => [i + 1, parse.frames.read(q.buffer, loader.engine.rawsource)]));
    let frames = Object.fromEntries(framearch.map((q, i) => [q.fileid, opdecoder_1.parse.frames.read(q.buffer, loader.engine.rawsource)]));
    //three.js doesn't interpolate from end frame to start, so insert the start frame at the end
    const insertLoopFrame = true;
    //calculate frame times
    let endtime = 0;
    let keyframetimeslist = [];
    let orderedframes = [];
    for (let i = 0; i < sequenceframes.length; i++) {
        let seqframe = sequenceframes[i];
        if (frames[seqframe.frameidlow]) {
            keyframetimeslist.push(endtime);
            endtime += seqframe.framelength * 0.020;
            orderedframes.push(frames[seqframe.frameidlow]);
        }
        else {
            console.log(`missing animation frame ${seqframe.frameidlow} in sequence ${seqframe.frameidhi}`);
        }
    }
    if (insertLoopFrame) {
        orderedframes.push(orderedframes[0]);
        keyframetimeslist.push(endtime);
    }
    let framebase = opdecoder_1.parse.framemaps.read(await loader.engine.getFileById(constants_1.cacheMajors.framemaps, orderedframes[0].probably_framemap_id), loader.engine.rawsource);
    // let { bones } = buildFramebaseSkeleton(framebase);
    let keyframetimes = new Float32Array(keyframetimeslist);
    let clips = getFrameClips(framebase, orderedframes);
    return (model) => {
        let centers = (0, rt7model_1.getBoneCenters)(model);
        let transforms = bakeAnimation(framebase, clips, keyframetimes, centers)
            .map((arr, i) => ({ id: i, trans: arr }));
        let nframes = keyframetimes.length;
        let tracks = [];
        //reused holders
        let matrix = new three_1.Matrix4();
        let scale = new three_1.Vector3();
        let translate = new three_1.Vector3();
        let prerotate = new three_1.Quaternion();
        let postrotate = new three_1.Quaternion();
        let skippedbones = 0;
        for (let trans of transforms) {
            if (trans.id == 0) {
                //don't emit keyframetrack for static root bone, since it is a noop and
                //bone name doesn't match (doing this messes with export)
                continue;
            }
            if (trans.id >= model.bonecount) {
                skippedbones++;
                continue;
            }
            let rootname = `root_${trans.id}`;
            let leafname = `bone_${trans.id}`;
            let scales = new Float32Array(nframes * 3);
            let positions = new Float32Array(nframes * 3);
            let prerotates = new Float32Array(nframes * 4);
            let postrotates = new Float32Array(nframes * 4);
            for (let i = 0; i < nframes; i++) {
                matrix.fromArray(trans.trans, i * 16);
                matrixToDoubleBone(matrix, translate, prerotate, scale, postrotate);
                translate.toArray(positions, i * 3);
                prerotate.toArray(prerotates, i * 4);
                scale.toArray(scales, i * 3);
                postrotate.toArray(postrotates, i * 4);
            }
            tracks.push(new three_1.VectorKeyframeTrack(`${rootname}.position`, keyframetimes, positions));
            tracks.push(new three_1.QuaternionKeyframeTrack(`${rootname}.quaternion`, keyframetimes, prerotates));
            tracks.push(new three_1.VectorKeyframeTrack(`${rootname}.scale`, keyframetimes, scales));
            tracks.push(new three_1.QuaternionKeyframeTrack(`${leafname}.quaternion`, keyframetimes, postrotates));
        }
        if (skippedbones != 0) {
            console.log("skipped " + skippedbones + " bone animations since the model didn't have them");
        }
        let clip = new three_1.AnimationClip("anim", undefined, tracks);
        return clip;
    };
}
function matrixToDoubleBone(matrix, translate, rotate1, scale, rotate2) {
    matrix.decompose(translate, rotate1, scale);
    rotate2.identity();
    // this would have resulted in perfect reconstruction, however SVD is not stable when animated
    // let mat2 = [
    // 	matrix.elements.slice(0, 3),
    // 	matrix.elements.slice(4, 7),
    // 	matrix.elements.slice(8, 11),
    // ]
    // translate.set(matrix.elements[12], matrix.elements[13], matrix.elements[14]);
    // let { q, u, v } = SVD(mat2);
    // let pre = new Matrix4();
    // let post = new Matrix4();
    // pre.set(
    // 	u[0][0], u[0][1], u[0][2], 0,
    // 	u[1][0], u[1][1], u[1][2], 0,
    // 	u[2][0], u[2][1], u[2][2], 0,
    // 	0, 0, 0, 1
    // );
    // post.set(
    // 	v[0][0], v[0][1], v[0][2], 0,
    // 	v[1][0], v[1][1], v[1][2], 0,
    // 	v[2][0], v[2][1], v[2][2], 0,
    // 	0, 0, 0, 1
    // ).transpose();
    // let predet = pre.determinant();
    // let postdet = post.determinant();
    // if (Math.sign(predet) != Math.sign(postdet)) {
    // 	q[0] = -q[0];//flip one of the scales if only one of our rotates has a flip
    // }
    // if (predet < 0) {
    // 	pre.elements[0] *= -1;
    // 	pre.elements[4] *= -1;
    // 	pre.elements[8] *= -1;
    // 	pre.elements[12] *= -1;
    // }
    // if (postdet < 0) {
    // 	post.elements[0] *= -1;
    // 	post.elements[1] *= -1;
    // 	post.elements[2] *= -1;
    // 	post.elements[3] *= -1;
    // }
    // rotate1.setFromRotationMatrix(pre);
    // rotate2.setFromRotationMatrix(post);
    // scale.set(q[0], q[1], q[2]);
}
function bakeAnimation(base, clips, frametimes, bonecenters) {
    let nframes = frametimes.length;
    let matrix = new three_1.Matrix4();
    let transform = new three_1.Matrix4();
    let quat = new three_1.Quaternion();
    let pivotmatrixright = new three_1.Matrix4();
    let pivotmatrixleft = new three_1.Matrix4();
    let nbones = Math.max(...base.data.flatMap(q => q.data)) + 1 + 1; //len, so max+1, 1 extra for root bone
    let bonestates = [];
    for (let i = 0; i < nbones; i++) {
        let bonematrices = new Float32Array(16 * nframes);
        let center = bonecenters[i];
        let x = (!center || center.weightsum == 0 ? 0 : center.xsum / center.weightsum);
        let y = (!center || center.weightsum == 0 ? 0 : center.ysum / center.weightsum);
        let z = (!center || center.weightsum == 0 ? 0 : center.zsum / center.weightsum);
        for (let j = 0; j < nframes; j++) {
            bonematrices[j * 16 + 0] = 1;
            bonematrices[j * 16 + 5] = 1;
            bonematrices[j * 16 + 10] = 1;
            bonematrices[j * 16 + 15] = 1;
            bonematrices[j * 16 + 12] = x;
            bonematrices[j * 16 + 13] = y;
            bonematrices[j * 16 + 14] = z;
        }
        bonestates.push(bonematrices);
    }
    let pivot = new three_1.Vector3();
    for (let framenr = 0; framenr < nframes; framenr++) {
        pivot.set(0, 0, 0);
        let matrixoffset = framenr * 16;
        for (let [stepnr, step] of base.data.entries()) {
            let clip = clips[stepnr];
            if (step.type == 0) {
                pivot.fromArray(clip, framenr * 3);
                let sumx = 0, sumy = 0, sumz = 0;
                let weight = 0;
                for (let boneid of step.data) {
                    let center = bonecenters[boneid + 1];
                    let matrices = bonestates[boneid + 1];
                    if (center) {
                        sumx += matrices[matrixoffset + 12] * center.weightsum;
                        sumy += matrices[matrixoffset + 13] * center.weightsum;
                        sumz += matrices[matrixoffset + 14] * center.weightsum;
                        weight += center.weightsum;
                    }
                }
                if (weight != 0) {
                    pivot.set(pivot.x + sumx / weight, pivot.y + sumy / weight, pivot.z + sumz / weight);
                }
                pivotmatrixright.makeTranslation(-pivot.x, -pivot.y, -pivot.z);
                pivotmatrixleft.makeTranslation(pivot.x, pivot.y, pivot.z);
            }
            if (step.type == 1) {
                for (let boneid of step.data) {
                    let bone = bonestates[boneid + 1];
                    bone[matrixoffset + 12] += clip[framenr * 3 + 0];
                    bone[matrixoffset + 13] += clip[framenr * 3 + 1];
                    bone[matrixoffset + 14] += clip[framenr * 3 + 2];
                }
            }
            if (step.type == 2) {
                quat.fromArray(clip, framenr * 4);
                transform.makeRotationFromQuaternion(quat);
                transform.multiply(pivotmatrixright);
                transform.premultiply(pivotmatrixleft);
                for (let boneid of step.data) {
                    let bone = bonestates[boneid + 1];
                    matrix.fromArray(bone, matrixoffset);
                    matrix.premultiply(transform);
                    matrix.toArray(bone, matrixoffset);
                }
            }
            if (step.type == 3) {
                transform.makeScale(clip[framenr * 3 + 0], clip[framenr * 3 + 1], clip[framenr * 3 + 2]);
                transform.multiply(pivotmatrixright);
                transform.premultiply(pivotmatrixleft);
                for (let boneid of step.data) {
                    let bone = bonestates[boneid + 1];
                    matrix.fromArray(bone, matrixoffset);
                    matrix.premultiply(transform);
                    matrix.toArray(bone, matrixoffset);
                }
            }
        }
    }
    return bonestates;
}
function getFrameClips(framebase, framesparsed) {
    let frames = framesparsed.map(framedata => {
        //for some reason when using live/openrs2 source this file has internal chunking into header/flags/animdata
        return {
            flags: framedata.flags,
            animdata: framedata.animdata,
            dataindex: 0,
            baseid: framedata.probably_framemap_id,
            stream: new utils_1.Stream(Buffer.from(framedata.animdata))
        };
    });
    let clips = [];
    for (let [index, base] of framebase.data.entries()) {
        let nfields = [3, 3, 4, 3, 3, 4, 3, 3, 3, 3, 3][base.type];
        let rawclip = new Float32Array(nfields * frames.length);
        let clipindex = 0;
        let tempquat = new three_1.Quaternion();
        let tempEuler = new three_1.Euler();
        for (let frame of frames) {
            let flag = frame?.flags[index] ?? 0;
            if (flag & ~7) {
                console.log("unexpexted frame data flag " + (flag & ~7));
            }
            //there seems to actually be data here
            if (base.type == 0) {
                rawclip[clipindex++] = (flag & 1 ? frame.stream.readShortSmartBias() : 0);
                rawclip[clipindex++] = (flag & 2 ? frame.stream.readShortSmartBias() : 0);
                rawclip[clipindex++] = (flag & 4 ? frame.stream.readShortSmartBias() : 0);
                if (flag & 7) {
                    console.log("type 0 data", flag, [...rawclip.slice(clipindex - 3, clipindex)]);
                }
            }
            //translate
            if (base.type == 1) {
                rawclip[clipindex++] = (flag & 1 ? frame.stream.readShortSmartBias() : 0);
                rawclip[clipindex++] = -(flag & 2 ? frame.stream.readShortSmartBias() : 0);
                rawclip[clipindex++] = (flag & 4 ? frame.stream.readShortSmartBias() : 0);
            }
            //rotate
            if (base.type == 2) {
                let rotx = 0;
                if (flag & 1) {
                    let comp1 = frame.stream.readShortSmartBias();
                    let comp2 = frame.stream.readShortSmartBias();
                    rotx = Math.atan2(comp1, comp2);
                    // console.log(rotx);
                }
                let roty = 0;
                if (flag & 2) {
                    let comp1 = frame.stream.readShortSmartBias();
                    let comp2 = frame.stream.readShortSmartBias();
                    roty = Math.atan2(comp1, comp2);
                    // console.log(rotx);
                }
                let rotz = 0;
                if (flag & 4) {
                    let comp1 = frame.stream.readShortSmartBias();
                    let comp2 = frame.stream.readShortSmartBias();
                    rotz = Math.atan2(comp1, comp2);
                    // console.log(rotx);
                }
                // let rotx = (flag & 1 ? Math.atan2(frame.stream.readShortSmartBias(),frame.stream.readShortSmartBias()) : 0);
                // let roty = (flag & 2 ? Math.atan2(frame.stream.readShortSmartBias(),frame.stream.readShortSmartBias()) : 0);
                // let rotz = (flag & 4 ? Math.atan2(frame.stream.readShortSmartBias(),frame.stream.readShortSmartBias()) : 0);
                tempEuler.set(rotx, roty, rotz, "YXZ");
                tempquat.setFromEuler(tempEuler);
                tempquat.toArray(rawclip, clipindex);
                clipindex += 4;
            }
            //scale?
            if (base.type == 3) {
                rawclip[clipindex++] = (flag & 1 ? frame.stream.readShortSmartBias() : 128) / 128;
                rawclip[clipindex++] = (flag & 2 ? frame.stream.readShortSmartBias() : 128) / 128;
                rawclip[clipindex++] = (flag & 4 ? frame.stream.readShortSmartBias() : 128) / 128;
            }
            //others todo
            if (base.type == 5) {
                rawclip[clipindex++] = (flag & 1 ? frame.stream.readUShortSmart() : 0);
                rawclip[clipindex++] = (flag & 2 ? frame.stream.readUShortSmart() : 0);
                rawclip[clipindex++] = (flag & 4 ? frame.stream.readUShortSmart() : 0);
            }
            else if (base.type >= 4) {
                rawclip[clipindex++] = (flag & 1 ? frame.stream.readUShortSmart() : 0);
                rawclip[clipindex++] = (flag & 2 ? frame.stream.readUShortSmart() : 0);
                rawclip[clipindex++] = (flag & 4 ? frame.stream.readUShortSmart() : 0);
            }
        }
        clips.push(rawclip);
    }
    frames.forEach((q, i) => {
        let bytes = q.stream.bytesLeft();
        if (bytes != 0) {
            console.warn("ints left in anim decode: " + bytes, i);
            let counts = {};
            framebase.data.map((fr, i) => {
                // if ([0, 1, 2, 3].indexOf(fr.type) == -1 && (q.flags[i] ?? 0) != 0) {
                // console.log(fr.type, q.flags[i]);
                counts[fr.type] = (counts[fr.type] ?? 0) + (q.flags[i] ?? 0).toString(2).replaceAll("0", "").length;
                // }
            });
            console.log(counts);
        }
    });
    return clips;
}
