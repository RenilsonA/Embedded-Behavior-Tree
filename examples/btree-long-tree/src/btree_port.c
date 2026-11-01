/**
 * @file btree_port.c
 * @brief Platform functions required by btree-lib (see btree_common.h).
 */

#include "btree_common.h"
#include "sl_sleeptimer.h"
#include "SEGGER_RTT.h"

int btree_common_delay_ms(uint32_t timeout_ms)
{
    /* sl_sleeptimer_delay_millisecond() takes at most UINT16_MAX ms per call. */
    while (timeout_ms > 0u) {
        uint16_t chunk = (timeout_ms > UINT16_MAX) ? UINT16_MAX : (uint16_t)timeout_ms;
        sl_sleeptimer_delay_millisecond(chunk);
        timeout_ms -= chunk;
    }
    return 0;
}

#if BTREE_COMMON_DEBUG
void btree_common_debug_output(const char *line)
{
    SEGGER_RTT_printf(0, "%s", line);
}
#endif
