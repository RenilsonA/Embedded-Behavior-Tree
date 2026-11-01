/**
 * @file btree_port.c
 * @brief Platform functions required by btree-lib (see btree_common.h),
 *        written with the C standard library only.
 */

#include <stdio.h>
#include <time.h>

#include "btree_common.h"

int btree_common_delay_ms(uint32_t timeout_ms)
{
    /* ISO C has no sleep function, so this busy-waits on clock().
       On a microcontroller use your RTOS/HAL delay instead. */
    clock_t start = clock();
    clock_t ticks = (clock_t)(((double)timeout_ms * CLOCKS_PER_SEC) / 1000.0);

    if (start == (clock_t)-1) {
        return -1; /* No clock available: the Sleep node fails. */
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
