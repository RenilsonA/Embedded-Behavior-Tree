/**
 * @file btree_port.c
 * @brief Platform functions required by btree-lib (see btree_common.h).
 */

#include "SEGGER_RTT.h"
#include "btree_common.h"
#include "os.h"

int btree_common_delay_ms(uint32_t timeout_ms)
{
    RTOS_ERR os_err;

    OSTimeDlyHMSM((CPU_INT16U) (timeout_ms / 3600000u),
                  (CPU_INT16U) ((timeout_ms / 60000u) % 60u),
                  (CPU_INT16U) ((timeout_ms / 1000u) % 60u),
                  (CPU_INT32U) (timeout_ms % 1000u), OS_OPT_TIME_HMSM_STRICT, &os_err);

    return (RTOS_ERR_CODE_GET(os_err) == RTOS_ERR_NONE) ? 0 : -1;
}

#if BTREE_COMMON_DEBUG
void btree_common_debug_output(const char *line)
{
    SEGGER_RTT_printf(0, "%s", line);
}
#endif
