set(TARGET_NAME Failure)

add_library (${TARGET_NAME}
  fail.cpp
)

set_target_properties(${TARGET_NAME}
  PROPERTIES
    CXX_STANDARD 20
    CXX_STANDARD_REQUIRED ON
    CXX_EXTENSIONS OFF
)