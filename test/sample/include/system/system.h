#include <string>

// Marked as System header in CMake
// No warning should be issued if ignoreSystemHeaders is used
const char *systemHeaderFunction()
{
  std::string s;
  return s.c_str(); // C26816
}