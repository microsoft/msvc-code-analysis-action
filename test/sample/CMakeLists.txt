cmake_minimum_required (VERSION 3.20.5)
project (Sample)

set(PROPERTY CXX_STANDARD 20)

add_library (Sample src/test.cpp)

target_include_directories (Sample SYSTEM PUBLIC ${CMAKE_CURRENT_SOURCE_DIR}/include)