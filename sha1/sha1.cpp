#ifdef __EMSCRIPTEN__
#include <emscripten.h>
#endif

#ifndef EMSCRIPTEN_KEEPALIVE
#define EMSCRIPTEN_KEEPALIVE
#endif

using usize = unsigned int; // 4-bytes in webassembly
using u64 = unsigned long long;
using u8 = unsigned char;
using u32 = unsigned int;
using i32 = int;

// The max chunk size is 1MB, and the sha-1 hash can add an extra 64-byte block at the end
static constexpr usize maxBufferSize = 1 * 1024 * 1024 + 64;
static u8 memoryBuffer[maxBufferSize]; // Hash input should be written here
static u8 resultBuffer[20];

extern "C" EMSCRIPTEN_KEEPALIVE u8* getMemoryBuffer()
{
    return memoryBuffer;
}

struct HasherState
{
    // Sha-1 internal state
    u32 h0{ };
    u32 h1{ };
    u32 h2{ };
    u32 h3{ };
    u32 h4{ };

    u64 ml{ }; // Message length in bits

    usize totalSizeInBytes{ };
    usize processedNumBytes{ };
};

// To allow large chunks of data to be hashed, the hash process is split into multiple parts, and the state is kept between the calls
static HasherState state{ };

// https://en.wikipedia.org/wiki/SHA-1#SHA-1_pseudocode

extern "C" EMSCRIPTEN_KEEPALIVE void sha1Initialize(usize totalDataSizeInBytes)
{
    state = HasherState
    {
        // Sha-1 initial constants
        .h0 = 0x67452301,
        .h1 = 0xEFCDAB89,
        .h2 = 0x98BADCFE,
        .h3 = 0x10325476,
        .h4 = 0xC3D2E1F0,

        .ml = (u64)totalDataSizeInBytes * 8,

        .totalSizeInBytes = totalDataSizeInBytes,
        .processedNumBytes = 0,
    };
}

extern "C" EMSCRIPTEN_KEEPALIVE void sha1ProcessChunk(usize currentDataSizeInBytes)
{
    // The data size per block must not be larger than 16MB, and must be a multiple of 64 bytes (except for the last chunk)

    usize writeIndex = currentDataSizeInBytes;

    bool isLastBlock = (state.processedNumBytes + currentDataSizeInBytes) == state.totalSizeInBytes;
    if (isLastBlock)
    {
        // For the last block, add extra bytes required by sha-1
        // We always have at least 64 free bytes at the end

        // Append the bit '1' to the message
        memoryBuffer[writeIndex++] = 0x80;

        // Append 0 <= k < 512 bits '0', such that the resulting message length in bits is congruent to 448 (mod 512)
        // Which is 0 <= k < 64 bytes, and is congruent to 56 mod 64
        while ((writeIndex & 63) != 56)
        {
            memoryBuffer[writeIndex++] = 0;
        }

        // Append ml, the original message length in bits, as a 64-bit big-endian integer
        for (usize i = 0; i < 8; ++i)
        {
            usize shift = (7 - i) * 8;
            memoryBuffer[writeIndex++] = (u8)((state.ml >> shift) & 0xff);
        }
    }

    // Process the message in successive 512-bit chunks

    // If any state is available from previous chunks, reuse them
    u32& h0 = state.h0;
    u32& h1 = state.h1;
    u32& h2 = state.h2;
    u32& h3 = state.h3;
    u32& h4 = state.h4;

    u32 w[80]; // Data is overwritten in each loop, no need to initialize this

    for (usize i = 0; i < writeIndex;)
    {
        // Break chunk into sixteen 32-bit big-endian words w[j], 0 <= j < 16

#define CHUNK_UNROLL(j)                                      \
        do                                                   \
        {                                                    \
            u32 b0 = (u32)memoryBuffer[i++];                 \
            u32 b1 = (u32)memoryBuffer[i++];                 \
            u32 b2 = (u32)memoryBuffer[i++];                 \
            u32 b3 = (u32)memoryBuffer[i++];                 \
            w[j] = (b0 << 24) | (b1 << 16) | (b2 << 8) | b3; \
        } while(0)

        CHUNK_UNROLL(0);
        CHUNK_UNROLL(1);
        CHUNK_UNROLL(2);
        CHUNK_UNROLL(3);
        CHUNK_UNROLL(4);
        CHUNK_UNROLL(5);
        CHUNK_UNROLL(6);
        CHUNK_UNROLL(7);
        CHUNK_UNROLL(8);
        CHUNK_UNROLL(9);
        CHUNK_UNROLL(10);
        CHUNK_UNROLL(11);
        CHUNK_UNROLL(12);
        CHUNK_UNROLL(13);
        CHUNK_UNROLL(14);
        CHUNK_UNROLL(15);

        // Message schedule: extend the sixteen 32-bit words into eighty 32-bit words

#define MESSAGE_SCHEDULE(j)                                      \
        do                                                       \
        {                                                        \
            u32 n = w[j - 3] ^ w[j - 8] ^ w[j - 14] ^ w[j - 16]; \
            w[j] = (n << 1) | (n >> 31);                         \
        } while(0)

        MESSAGE_SCHEDULE(16);
        MESSAGE_SCHEDULE(17);
        MESSAGE_SCHEDULE(18);
        MESSAGE_SCHEDULE(19);
        MESSAGE_SCHEDULE(20);
        MESSAGE_SCHEDULE(21);
        MESSAGE_SCHEDULE(22);
        MESSAGE_SCHEDULE(23);
        MESSAGE_SCHEDULE(24);
        MESSAGE_SCHEDULE(25);
        MESSAGE_SCHEDULE(26);
        MESSAGE_SCHEDULE(27);
        MESSAGE_SCHEDULE(28);
        MESSAGE_SCHEDULE(29);
        MESSAGE_SCHEDULE(30);
        MESSAGE_SCHEDULE(31);
        MESSAGE_SCHEDULE(32);
        MESSAGE_SCHEDULE(33);
        MESSAGE_SCHEDULE(34);
        MESSAGE_SCHEDULE(35);
        MESSAGE_SCHEDULE(36);
        MESSAGE_SCHEDULE(37);
        MESSAGE_SCHEDULE(38);
        MESSAGE_SCHEDULE(39);
        MESSAGE_SCHEDULE(40);
        MESSAGE_SCHEDULE(41);
        MESSAGE_SCHEDULE(42);
        MESSAGE_SCHEDULE(43);
        MESSAGE_SCHEDULE(44);
        MESSAGE_SCHEDULE(45);
        MESSAGE_SCHEDULE(46);
        MESSAGE_SCHEDULE(47);
        MESSAGE_SCHEDULE(48);
        MESSAGE_SCHEDULE(49);
        MESSAGE_SCHEDULE(50);
        MESSAGE_SCHEDULE(51);
        MESSAGE_SCHEDULE(52);
        MESSAGE_SCHEDULE(53);
        MESSAGE_SCHEDULE(54);
        MESSAGE_SCHEDULE(55);
        MESSAGE_SCHEDULE(56);
        MESSAGE_SCHEDULE(57);
        MESSAGE_SCHEDULE(58);
        MESSAGE_SCHEDULE(59);
        MESSAGE_SCHEDULE(60);
        MESSAGE_SCHEDULE(61);
        MESSAGE_SCHEDULE(62);
        MESSAGE_SCHEDULE(63);
        MESSAGE_SCHEDULE(64);
        MESSAGE_SCHEDULE(65);
        MESSAGE_SCHEDULE(66);
        MESSAGE_SCHEDULE(67);
        MESSAGE_SCHEDULE(68);
        MESSAGE_SCHEDULE(69);
        MESSAGE_SCHEDULE(70);
        MESSAGE_SCHEDULE(71);
        MESSAGE_SCHEDULE(72);
        MESSAGE_SCHEDULE(73);
        MESSAGE_SCHEDULE(74);
        MESSAGE_SCHEDULE(75);
        MESSAGE_SCHEDULE(76);
        MESSAGE_SCHEDULE(77);
        MESSAGE_SCHEDULE(78);
        MESSAGE_SCHEDULE(79);

        // Initialize hash value for this chunk
        u32 a = h0;
        u32 b = h1;
        u32 c = h2;
        u32 d = h3;
        u32 e = h4;

        // Main loop

#define MAIN_LOOP_AFTER                                                                                                     \
        e = d;                                                                                                              \
        d = c;                                                                                                              \
        c = (b << 30) | (b >> 2);                                                                                           \
        b = a;                                                                                                              \
        a = temp;                                                                                                           \

#define MAIN_LOOP_0_20(j)                                                                                                   \
        do                                                                                                                  \
        {                                                                                                                   \
            u32 temp = (((a << 5) | (a >> 27)) + ((b & c) | (~b & d)) + e + w[j] + 0x5A827999) & 0x0ffffffff;               \
            MAIN_LOOP_AFTER                                                                                                 \
        } while(0)

#define MAIN_LOOP_20_40(j)                                                                                                  \
        do                                                                                                                  \
        {                                                                                                                   \
            u32 temp = (((a << 5) | (a >> 27)) + (b ^ c ^ d) + e + w[j] + 0x6ED9EBA1) & 0x0ffffffff;                        \
            MAIN_LOOP_AFTER                                                                                                 \
        } while(0)

#define MAIN_LOOP_40_60(j)                                                                                                  \
        do                                                                                                                  \
        {                                                                                                                   \
            u32 temp = (((a << 5) | (a >> 27)) + ((b & c) | (b & d) | (c & d)) + e + w[j] + 0x8F1BBCDC) & 0x0ffffffff;      \
            MAIN_LOOP_AFTER                                                                                                 \
        } while(0)

#define MAIN_LOOP_60_80(j)                                                                                                  \
        do                                                                                                                  \
        {                                                                                                                   \
            u32 temp = (((a << 5) | (a >> 27)) + (b ^ c ^ d) + e + w[j] + 0xCA62C1D6) & 0x0ffffffff;                        \
            MAIN_LOOP_AFTER                                                                                                 \
        } while(0)

        MAIN_LOOP_0_20(0);
        MAIN_LOOP_0_20(1);
        MAIN_LOOP_0_20(2);
        MAIN_LOOP_0_20(3);
        MAIN_LOOP_0_20(4);
        MAIN_LOOP_0_20(5);
        MAIN_LOOP_0_20(6);
        MAIN_LOOP_0_20(7);
        MAIN_LOOP_0_20(8);
        MAIN_LOOP_0_20(9);
        MAIN_LOOP_0_20(10);
        MAIN_LOOP_0_20(11);
        MAIN_LOOP_0_20(12);
        MAIN_LOOP_0_20(13);
        MAIN_LOOP_0_20(14);
        MAIN_LOOP_0_20(15);
        MAIN_LOOP_0_20(16);
        MAIN_LOOP_0_20(17);
        MAIN_LOOP_0_20(18);
        MAIN_LOOP_0_20(19);

        MAIN_LOOP_20_40(20);
        MAIN_LOOP_20_40(21);
        MAIN_LOOP_20_40(22);
        MAIN_LOOP_20_40(23);
        MAIN_LOOP_20_40(24);
        MAIN_LOOP_20_40(25);
        MAIN_LOOP_20_40(26);
        MAIN_LOOP_20_40(27);
        MAIN_LOOP_20_40(28);
        MAIN_LOOP_20_40(29);
        MAIN_LOOP_20_40(30);
        MAIN_LOOP_20_40(31);
        MAIN_LOOP_20_40(32);
        MAIN_LOOP_20_40(33);
        MAIN_LOOP_20_40(34);
        MAIN_LOOP_20_40(35);
        MAIN_LOOP_20_40(36);
        MAIN_LOOP_20_40(37);
        MAIN_LOOP_20_40(38);
        MAIN_LOOP_20_40(39);

        MAIN_LOOP_40_60(40);
        MAIN_LOOP_40_60(41);
        MAIN_LOOP_40_60(42);
        MAIN_LOOP_40_60(43);
        MAIN_LOOP_40_60(44);
        MAIN_LOOP_40_60(45);
        MAIN_LOOP_40_60(46);
        MAIN_LOOP_40_60(47);
        MAIN_LOOP_40_60(48);
        MAIN_LOOP_40_60(49);
        MAIN_LOOP_40_60(50);
        MAIN_LOOP_40_60(51);
        MAIN_LOOP_40_60(52);
        MAIN_LOOP_40_60(53);
        MAIN_LOOP_40_60(54);
        MAIN_LOOP_40_60(55);
        MAIN_LOOP_40_60(56);
        MAIN_LOOP_40_60(57);
        MAIN_LOOP_40_60(58);
        MAIN_LOOP_40_60(59);

        MAIN_LOOP_60_80(60);
        MAIN_LOOP_60_80(61);
        MAIN_LOOP_60_80(62);
        MAIN_LOOP_60_80(63);
        MAIN_LOOP_60_80(64);
        MAIN_LOOP_60_80(65);
        MAIN_LOOP_60_80(66);
        MAIN_LOOP_60_80(67);
        MAIN_LOOP_60_80(68);
        MAIN_LOOP_60_80(69);
        MAIN_LOOP_60_80(70);
        MAIN_LOOP_60_80(71);
        MAIN_LOOP_60_80(72);
        MAIN_LOOP_60_80(73);
        MAIN_LOOP_60_80(74);
        MAIN_LOOP_60_80(75);
        MAIN_LOOP_60_80(76);
        MAIN_LOOP_60_80(77);
        MAIN_LOOP_60_80(78);
        MAIN_LOOP_60_80(79);

        // Add this chunk's hash to result so far:
        h0 += a;
        h1 += b;
        h2 += c;
        h3 += d;
        h4 += e;
    }

    state.processedNumBytes += currentDataSizeInBytes;
}

extern "C" EMSCRIPTEN_KEEPALIVE const u8* sha1Finalize()
{
    usize resultWriteIndex = 0;

#define WRITE_RESULT_BE(h)                                      \
    do                                                          \
    {                                                           \
        resultBuffer[resultWriteIndex++] = h >> 24;             \
        resultBuffer[resultWriteIndex++] = (h >> 16) & 0xff;    \
        resultBuffer[resultWriteIndex++] = (h >> 8) & 0xff;     \
        resultBuffer[resultWriteIndex++] = h & 0xff;            \
    } while(0)

    WRITE_RESULT_BE(state.h0);
    WRITE_RESULT_BE(state.h1);
    WRITE_RESULT_BE(state.h2);
    WRITE_RESULT_BE(state.h3);
    WRITE_RESULT_BE(state.h4);

    return resultBuffer;
}
