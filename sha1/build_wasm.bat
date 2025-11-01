mkdir bin

REM Build without SIMD
CALL em++ --no-entry -sSTANDALONE_WASM -O3 -flto -sENVIRONMENT=web -sMALLOC=none -fno-vectorize -fno-slp-vectorize -o "bin/Sha1.js" sha1.cpp

REM Build with SIMD
CALL em++ --no-entry -sSTANDALONE_WASM -O3 -flto -sENVIRONMENT=web -sMALLOC=none -msimd128 -o "bin/Sha1Simd.js" sha1.cpp
