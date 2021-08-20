#include <test.h>
#include <optional>

std::optional<int> getTempOptional() { return {}; }

void C26815()
{
    if (const auto val = *getTempOptional()) // C26815
    {
        (void)val;
    }
}