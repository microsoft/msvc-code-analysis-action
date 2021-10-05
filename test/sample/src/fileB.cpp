// Include the same header as fileA to ensure duplicate warnings are not produced
#include <regular.h>

constexpr void C6001()
{
    int x[4];
    x[4] = 1;
}

int main() noexcept {
    return 0;
}
