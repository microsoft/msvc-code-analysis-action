#include <system.h>
#include <regular.h>
#include <optional>

std::optional<int> getTempOptional() noexcept { return {}; }

void C26815() noexcept
{
    if (const auto val = *getTempOptional()) // C26815
    {
        (void)val;
    }
}

int main() noexcept {
    return 0;
}