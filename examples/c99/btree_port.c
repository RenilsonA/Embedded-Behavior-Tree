#include <stdio.h>
#include <time.h>

#include "btree_common.h"

int btree_common_delay_ms(uint32_t timeout_ms)
{
    clock_t start = clock();
    clock_t ticks = (clock_t) (((double) timeout_ms * CLOCKS_PER_SEC) / 1000.0);

    if (start == (clock_t) -1) {
        return -1;
    }
    while ((clock() - start) < ticks) {
    }
    return 0;
}

#if BTREE_COMMON_DEBUG
void btree_common_debug_output(const char *line)
{
    fputs(line, stdout);
}
#endif
