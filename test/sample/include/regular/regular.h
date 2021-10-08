#include <string>

// Duplicate warnings will be avoided in headers included > 1 times
const char *regularHeaderFunction()
{
  std::string s;
  return s.c_str(); // C26816
}