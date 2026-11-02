/**
 * @file btree_main_main_ble.c
 * @author Renilson Almeida (joserenilson.silva@edge.ufal.br)
 * @brief Interface of main_ble tree.
 * @version 1.0
 * @date 18/05/2025
 *
 */

#include "btree_main_main_ble.h"

#include "driver/gpio.h"
#include "freertos/FreeRTOS.h"
#include "freertos/task.h"
#include "string.h"

btree_definition_status_t btree_main_main_ble_not_recv_blinky_msg(void)
{
    uint32_t msg_size = 0;
    uint8_t msg[32]   = {0};

    btree_main_blackboard_get_buffer(BTREE_MAIN_BLACKBOARD_BUFFER_MSG, msg, &msg_size);

    if (strstr((char *) msg, "led") != NULL) {
        return BTREE_DEFINITION_STATUS_FAIL;
    }

    return BTREE_DEFINITION_STATUS_SUCCESS;
}

btree_definition_status_t btree_main_main_ble_blynk_led(void)
{
    btree_main_reset_blackboard();
    gpio_set_level(GPIO_NUM_2, 1);
    vTaskDelay(pdMS_TO_TICKS(500));
    gpio_set_level(GPIO_NUM_2, 0);
    vTaskDelay(pdMS_TO_TICKS(500));
    return BTREE_DEFINITION_STATUS_SUCCESS;
}

btree_definition_status_t btree_main_main_ble_just_standby(void)
{
    /////////////////////////// Just wait one msg to validate
    ////////////////////////////////
    uint32_t msg_size = 0;
    uint8_t msg[32]   = {0};

    btree_main_blackboard_get_buffer(BTREE_MAIN_BLACKBOARD_BUFFER_MSG, msg, &msg_size);

    if ((strstr((char *) msg, "led") != NULL)
        || (strstr((char *) msg, "print") != NULL)) {
        return BTREE_DEFINITION_STATUS_SUCCESS;
    }
    /////////////////////////// Just wait one msg to validate
    ////////////////////////////////

    return BTREE_DEFINITION_STATUS_STAND_BY;
}

btree_definition_status_t btree_main_main_ble_is_not_recv_echo_msg(void)
{
    uint32_t msg_size = 0;
    uint8_t msg[32]   = {0};

    btree_main_blackboard_get_buffer(BTREE_MAIN_BLACKBOARD_BUFFER_MSG, msg, &msg_size);

    if (strstr((char *) msg, "print") != NULL) {
        return BTREE_DEFINITION_STATUS_FAIL;
    }

    return BTREE_DEFINITION_STATUS_SUCCESS;
}

btree_definition_status_t btree_main_main_ble_print_msg(void)
{
    uint32_t msg_size = 0;
    uint8_t msg[32]   = {0};

    btree_main_blackboard_get_buffer(BTREE_MAIN_BLACKBOARD_BUFFER_MSG, msg, &msg_size);

    printf("%s", &msg[6]);
    btree_main_reset_blackboard();

    return BTREE_DEFINITION_STATUS_SUCCESS;
}
