
/**
 * Simple WAV header builder for the Sovereign Substrate.
 * Wraps raw PCM data from the Jagex Cache (Archive 40) into a valid RIFF container.
 */
export function wrapPcmInWav(pcmData: Buffer, sampleRate: number, channels: number = 1, bitsPerSample: number = 16): Buffer {
    const header = Buffer.alloc(44);
    
    // RIFF identifier
    header.write('RIFF', 0);
    // File length minus RIFF identifier and length
    header.writeUInt32LE(36 + pcmData.length, 4);
    // WAVE identifier
    header.write('WAVE', 8);
    // fmt chunk identifier
    header.write('fmt ', 12);
    // Length of fmt chunk
    header.writeUInt32LE(16, 16);
    // Audio format (1 is PCM)
    header.writeUInt16LE(1, 20);
    // Number of channels
    header.writeUInt16LE(channels, 22);
    // Sample rate
    header.writeUInt32LE(sampleRate, 24);
    // Byte rate (SampleRate * Channels * BitsPerSample / 8)
    header.writeUInt32LE(sampleRate * channels * bitsPerSample / 8, 28);
    // Block align (Channels * BitsPerSample / 8)
    header.writeUInt16LE(channels * bitsPerSample / 8, 32);
    // Bits per sample
    header.writeUInt16LE(bitsPerSample, 34);
    // data chunk identifier
    header.write('data', 36);
    // Data length
    header.writeUInt32LE(pcmData.length, 40);

    return Buffer.concat([header, pcmData]);
}
