cmake_minimum_required (VERSION 3.20.5)
project (Sample)

add_library (${PROJECT_NAME}
  src/fileA.cpp
  src/fileb.cpp
)

set_target_properties(${PROJECT_NAME}
  PROPERTIES
    CXX_STANDARD 20
    CXX_STANDARD_REQUIRED ON
    CXX_EXTENSIONS OFF
)

target_include_directories (${PROJECT_NAME}
  SYSTEM PUBLIC
    ${CMAKE_CURRENT_SOURCE_DIR}/include/system
)

target_include_directories (${PROJECT_NAME}
  PUBLIC
    ${CMAKE_CURRENT_SOURCE_DIR}/include/regular
)


add_subdirectory(failure)