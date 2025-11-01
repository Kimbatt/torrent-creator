#ifdef EMSCRIPTEN
#include <emscripten.h>
#endif

#ifndef EMSCRIPTEN_KEEPALIVE
#define EMSCRIPTEN_KEEPALIVE
#endif

using _size_t = unsigned int; // 4-bytes in webassembly
using _uint64_t = unsigned long long;
using _uint8_t = unsigned char;
using _uint32_t = unsigned int;
using _int32_t = int;

// The max block size for a torrent is 16MB, and the sha-1 hash can add an extra 64-byte block at the end
static constexpr _size_t maxBufferSize = 16 * 1024 * 1024 + 64;
static _uint8_t memoryBuffer[maxBufferSize];
static _uint8_t resultBuffer[20];

extern "C" EMSCRIPTEN_KEEPALIVE _uint8_t* getMemoryBuffer()
{
    return memoryBuffer;
}

extern "C" EMSCRIPTEN_KEEPALIVE const _uint8_t* sha1(_size_t sizeInBytes)
{
    // https://en.wikipedia.org/wiki/SHA-1#SHA-1_pseudocode

    _uint64_t ml = (_uint64_t)sizeInBytes * 8; // Message length in bits

    _size_t writeIndex = sizeInBytes;

    // Append the bit '1' to the message
    memoryBuffer[writeIndex++] = 0x80;

    // Append 0 <= k < 512 bits '0', such that the resulting message length in bits is congruent to 448 (mod 512)
    // Which is 0 <= k < 64 bytes, and is congruent to 56 mod 64
    while ((writeIndex & 63) != 56)
    {
        memoryBuffer[writeIndex++] = 0;
    }

    // Append ml, the original message length in bits, as a 64-bit big-endian integer
    for (_size_t i = 0; i < 8; ++i)
    {
        _size_t shift = (7 - i) * 8;
        memoryBuffer[writeIndex++] = (_uint8_t)((ml >> shift) & 0xff);
    }

    // Process the message in successive 512-bit chunks

    _uint32_t h0 = 0x67452301;
    _uint32_t h1 = 0xEFCDAB89;
    _uint32_t h2 = 0x98BADCFE;
    _uint32_t h3 = 0x10325476;
    _uint32_t h4 = 0xC3D2E1F0;

    _uint32_t w[80];
    for (_size_t i = 0; i < writeIndex;)
    {
        // Break chunk into sixteen 32-bit big-endian words w[j], 0 <= j < 16

#define CHUNK_UNROLL(j)                                         \
        do                                                      \
        {                                                       \
            _uint32_t b0 = (_uint32_t)memoryBuffer[i++];        \
            _uint32_t b1 = (_uint32_t)memoryBuffer[i++];        \
            _uint32_t b2 = (_uint32_t)memoryBuffer[i++];        \
            _uint32_t b3 = (_uint32_t)memoryBuffer[i++];        \
            w[j] = (b0 << 24) | (b1 << 16) | (b2 << 8) | b3;    \
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

#define MESSAGE_SCHEDULE(j)                                             \
        do                                                              \
        {                                                               \
            _uint32_t n = w[j - 3] ^ w[j - 8] ^ w[j - 14] ^ w[j - 16];  \
            w[j] = (n << 1) | (n >> 31);                                \
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
        _uint32_t a = h0;
        _uint32_t b = h1;
        _uint32_t c = h2;
        _uint32_t d = h3;
        _uint32_t e = h4;

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
            _uint32_t temp = (((a << 5) | (a >> 27)) + ((b & c) | (~b & d)) + e + w[j] + 0x5A827999) & 0x0ffffffff;         \
            MAIN_LOOP_AFTER                                                                                                 \
        } while(0)

#define MAIN_LOOP_20_40(j)                                                                                                  \
        do                                                                                                                  \
        {                                                                                                                   \
            _uint32_t temp = (((a << 5) | (a >> 27)) + (b ^ c ^ d) + e + w[j] + 0x6ED9EBA1) & 0x0ffffffff;                  \
            MAIN_LOOP_AFTER                                                                                                 \
        } while(0)

#define MAIN_LOOP_40_60(j)                                                                                                  \
        do                                                                                                                  \
        {                                                                                                                   \
            _uint32_t temp = (((a << 5) | (a >> 27)) + ((b & c) | (b & d) | (c & d)) + e + w[j] + 0x8F1BBCDC) & 0x0ffffffff;\
            MAIN_LOOP_AFTER                                                                                                 \
        } while(0)

#define MAIN_LOOP_60_80(j)                                                                                                  \
        do                                                                                                                  \
        {                                                                                                                   \
            _uint32_t temp = (((a << 5) | (a >> 27)) + (b ^ c ^ d) + e + w[j] + 0xCA62C1D6) & 0x0ffffffff;                  \
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

    _size_t resultWriteIndex = 0;

#define WRITE_RESULT_BE(h)                                      \
    do                                                          \
    {                                                           \
        resultBuffer[resultWriteIndex++] = h >> 24;             \
        resultBuffer[resultWriteIndex++] = (h >> 16) & 0xff;    \
        resultBuffer[resultWriteIndex++] = (h >> 8) & 0xff;     \
        resultBuffer[resultWriteIndex++] = h & 0xff;            \
    } while(0)

    WRITE_RESULT_BE(h0);
    WRITE_RESULT_BE(h1);
    WRITE_RESULT_BE(h2);
    WRITE_RESULT_BE(h3);
    WRITE_RESULT_BE(h4);

    return resultBuffer;
}
