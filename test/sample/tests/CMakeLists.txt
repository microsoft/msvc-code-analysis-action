set(TARGET_NAME Tests)

add_library (${TARGET_NAME}
  test.cpp
)

set_target_properties(${TARGET_NAME}
  PROPERTIES
    CXX_STANDARD 20
    CXX_STANDARD_REQUIRED ON
    CXX_EXTENSIONS OFF
)