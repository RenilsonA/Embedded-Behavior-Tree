/**
 * @file btree_port.c
 * @brief Platform functions required by btree-lib (see btree_common.h).
 */

#include "btree_common.h"
#include "freertos/FreeRTOS.h"
#include "freertos/task.h"
#include <stdio.h>

int btree_common_delay_ms(uint32_t timeout_ms)
{
    vTaskDelay(pdMS_TO_TICKS(timeout_ms));
    return 0;
}

#if BTREE_COMMON_DEBUG
void btree_common_debug_output(const char *line)
{
    printf("%s", line);
}
#endif
