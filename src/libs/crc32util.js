"use strict";
//based on https://blog.stalkr.net/2011/03/crc-32-forging.html
//also check out https://stackoverflow.com/questions/1514040/reversing-crc32
Object.defineProperty(exports, "__esModule", { value: true });
exports.CrcBuilder = void 0;
exports.crc32 = crc32;
exports.crc32addInt = crc32addInt;
exports.crc32Interlaced = crc32Interlaced;
exports.crc32_backward = crc32_backward;
exports.intbuffer = intbuffer;
exports.forge_crcbytes = forge_crcbytes;
exports.forge = forge;
// Poly in "reversed" notation -- http://en.wikipedia.org/wiki/Cyclic_redundancy_check
const POLY = 0xedb88320; // CRC-32-IEEE 802.3
//POLY = 0x82F63B78 # CRC-32C (Castagnoli)
//POLY = 0xEB31D82E # CRC-32K (Koopman)
//POLY = 0xD5828281 # CRC-32Q
const crc32_table = new Uint32Array(256);
const crc32_reverse = new Uint32Array(256);
function build_crc_tables() {
    for (let i = 0; i < 256; i++) {
        let fwd = i;
        let rev = i << 24;
        for (let j = 8; j > 0; j--) {
            // build normal table
            if ((fwd & 1) == 1) {
                fwd = (fwd >>> 1) ^ POLY;
            }
            else {
                fwd >>>= 1;
            }
            //build reverse table =)
            if ((rev & 0x80000000) != 0) {
                rev = ((rev ^ POLY) << 1) | 1;
            }
            else {
                rev <<= 1;
            }
            rev &= 0xffffffff;
        }
        crc32_table[i] = fwd & 0xffffffff;
        crc32_reverse[i] = rev;
    }
}
build_crc_tables();
function crc32(buf, crc = 0, rangeStart = 0, rangeEnd = buf.length) {
    crc = crc ^ 0xffffffff;
    for (let i = rangeStart; i < rangeEnd; i++) {
        crc = (crc >>> 8) ^ crc32_table[(crc ^ buf[i]) & 0xff];
    }
    return (crc ^ 0xffffffff) >>> 0;
}
const staticintbuf = Buffer.alloc(4);
function crc32addInt(int, crc) {
    staticintbuf.writeUInt32BE(int >>> 0);
    return crc32(staticintbuf, crc);
}
class CrcBuilder {
    crc;
    constructor(initcrc = 0) {
        this.crc = initcrc ^ 0xffffffff;
    }
    addbyte(byte) {
        this.crc = (this.crc >>> 8) ^ crc32_table[(this.crc ^ (byte & 0xff)) & 0xff];
    }
    addUint16Flipped(u16) {
        this.crc = (this.crc >>> 8) ^ crc32_table[(this.crc ^ ((u16 >> 16) & 0xff)) & 0xff];
        this.crc = (this.crc >>> 8) ^ crc32_table[(this.crc ^ (u16 & 0xff)) & 0xff];
    }
    addUint16(u16) {
        this.crc = (this.crc >>> 8) ^ crc32_table[(this.crc ^ (u16 & 0xff)) & 0xff];
        this.crc = (this.crc >>> 8) ^ crc32_table[(this.crc ^ ((u16 >> 16) & 0xff)) & 0xff];
    }
    addUint32(u16) {
        this.crc = (this.crc >>> 8) ^ crc32_table[(this.crc ^ ((u16 >> 0) & 0xff)) & 0xff];
        this.crc = (this.crc >>> 8) ^ crc32_table[(this.crc ^ ((u16 >> 16) & 0xff)) & 0xff];
        this.crc = (this.crc >>> 8) ^ crc32_table[(this.crc ^ ((u16 >> 24) & 0xff)) & 0xff];
        this.crc = (this.crc >>> 8) ^ crc32_table[(this.crc ^ ((u16 >> 32) & 0xff)) & 0xff];
    }
    get() {
        return (this.crc ^ 0xffffffff) >>> 0;
    }
    fork() {
        return new CrcBuilder(this.get());
    }
}
exports.CrcBuilder = CrcBuilder;
/**
 * Used to hash parts of an interlaced buffer
 * @param buf the interlaced buffer
 * @param offset offset of byte group
 * @param stride number of bytes between the start of each occurance of the byte group
 * @param bytes number of bytes per group
 * @param chunkcount number of groups
 * @param crc optional starting value for crc
 */
function crc32Interlaced(buf, offset, stride, bytes, chunkcount, crc = 0) {
    crc = crc ^ 0xffffffff;
    for (let i = 0; i < chunkcount; i++) {
        let base = offset + i * stride;
        for (let b = 0; b < bytes; b++) {
            let index = base + b;
            crc = (crc >>> 8) ^ crc32_table[(crc ^ buf[index]) & 0xff];
        }
    }
    return (crc ^ 0xffffffff) >>> 0;
}
function crc32_backward(buf, crc, rangeStart = 0, rangeEnd = buf.length) {
    crc = crc ^ 0xffffffff;
    for (let i = rangeEnd - 1; i >= rangeStart; i--) {
        crc = ((crc << 8) & 0xffffffff) ^ crc32_reverse[crc >>> 24] ^ buf[i];
    }
    return (crc ^ 0xffffffff) >>> 0;
}
function intbuffer(value, bigendian = false, bytes = 4) {
    let buf = Buffer.alloc(bytes);
    if (bigendian) {
        buf.writeUIntBE(value >>> 0, 0, bytes);
    }
    else {
        buf.writeUIntLE(value >>> 0, 0, bytes);
    }
    return buf;
}
function forge_crcbytes(frontcrc, backcrc) {
    let fwd_bytes = intbuffer(frontcrc);
    let bkd_crc = crc32_backward(fwd_bytes, backcrc);
    return intbuffer(bkd_crc);
}
function forge(str, wanted_crc, pos = str.length, insert = true) {
    let endpos = (insert ? pos : pos + 4);
    let fwd_crc = crc32(str, 0, 0, pos);
    let bkd_crc = crc32_backward(str, wanted_crc, endpos);
    let res = Buffer.concat([
        str.subarray(0, pos),
        forge_crcbytes(fwd_crc, bkd_crc),
        str.subarray(endpos)
    ]);
    if (crc32(res) != wanted_crc) {
        console.error("forged crc did not match");
    }
    return res;
}
