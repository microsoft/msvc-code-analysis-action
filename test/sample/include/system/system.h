// Marked as System header in CMake
// No warning should be issued if ignoreSystemHeaders is used
#include <string>

const char *danglingRawPtrFromLocal()
{
  std::string s;
  return s.c_str(); // C26816
}