/**
 * Sovereign Thick Substrate Parser
 * Materializes textual serialized buffer data from pedagogical exports.
 * Supports: buffer <type>[<dimension>][]{<values>}
 */

export type ThickBufferData = Int16Array | Uint16Array | Int8Array | Uint8Array | Float32Array;

export class SovereignThickSubstrateParser {
  /**
   * Parses a serialized buffer string into a TypedArray.
   * Format: "buffer short[3][]{-8,168,-152,...}"
   */
  public static parseBuffer(str: string): ThickBufferData {
    if (!str.startsWith('buffer ')) {
      throw new Error(`Invalid buffer format: string must start with 'buffer '. Got: ${str.substring(0, 20)}...`);
    }

    const typeMatch = str.match(/^buffer (\w+)(\[(\d+)\])?(\[\])?\{(.*)\}$|null/);
    if (!typeMatch || typeMatch[0] === 'null') {
      throw new Error(`Failed to parse buffer structure: ${str.substring(0, 50)}...`);
    }

    const [, type, , dimensions, , valuesStr] = typeMatch;
    const values = valuesStr.split(',').map(v => v.trim()).filter(v => v !== '').map(Number);
    const dimCount = dimensions ? parseInt(dimensions, 10) : 1;

    switch (type) {
      case 'short':
        return new Int16Array(values);
      case 'ushort':
        return new Uint16Array(values);
      case 'byte':
        return new Int8Array(values);
      case 'ubyte':
        return new Uint8Array(values);
      case 'float':
        return new Float32Array(values);
      default:
        throw new Error(`Unsupported buffer type: ${type}`);
    }
  }

  /**
   * Materializes a "Thick" Model Substrate JSON.
   */
  public static materializeModelSubstrate(json: any): any {
    if (!json.meshdata) return json;

    const md = json.meshdata;
    const materialized: any = { ...md };

    // Common buffers in the provided grass substrate
    const bufferKeys = [
      'positionBuffer',
      'normalBuffer',
      'uvBuffer',
      'vertexColours',
      'vertexAlpha',
      'tagentBuffer'
    ];

    for (const key of bufferKeys) {
      if (typeof md[key] === 'string' && md[key].startsWith('buffer')) {
        materialized[key] = this.parseBuffer(md[key]);
      }
    }

    // Materialize sub-renders
    if (md.renders && Array.isArray(md.renders)) {
      materialized.renders = md.renders.map((r: any) => {
        if (typeof r.buf === 'string' && r.buf.startsWith('buffer')) {
          return { ...r, buf: this.parseBuffer(r.buf) };
        }
        return r;
      });
    }

    return { ...json, meshdata: materialized };
  }
}
