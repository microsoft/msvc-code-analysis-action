cmake_minimum_required (VERSION 3.13.7)
project (Sample)

add_library (Sample src/test.cpp)

target_include_directories (Sample SYSTEM PUBLIC ${CMAKE_CURRENT_SOURCE_DIR}/include)