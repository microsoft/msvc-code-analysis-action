// Duplicate warnings should be avoided in headers include > 1 times
#include <string>

const char *danglingRawPtrFromLocal()
{
  std::string s;
  return s.c_str(); // C26816
}