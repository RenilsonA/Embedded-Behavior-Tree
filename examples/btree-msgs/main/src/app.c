#include "app.h"

#include <stdio.h>

#include "btree_main_array.h"
#include "btree_manager.h"
#include "driver/gpio.h"
#include "esp_err.h"
#include "esp_log.h"
#include "freertos/FreeRTOS.h"
#include "freertos/task.h"
#include "nvs_flash.h"

#define LED_GPIO GPIO_NUM_2

btree_definition_status_t running_function(btree_definition_tree_data_t *struct_tree);

btree_definition_status_t success_function(btree_definition_tree_data_t *struct_tree);

btree_definition_status_t fail_function(btree_definition_tree_data_t *struct_tree);

btree_definition_status_t standby_function(btree_definition_tree_data_t *struct_tree);

static struct {
    bool need_tick;
    btree_definition_config_functions_t fuctions_tree;
} self = {
    .need_tick = true,
    .fuctions_tree =
        {
            .function_tick = btree_manager_tick_tree,
            .running_case  = running_function,
            .success_case  = success_function,
            .fail_case     = fail_function,
            .standby_case  = standby_function,
        },
};

void set_bool_tick(void)
{
    self.need_tick = true;
}

btree_definition_status_t running_function(btree_definition_tree_data_t *struct_tree)
{
    self.need_tick = true;
    return BTREE_DEFINITION_STATUS_RUNNING;
}

btree_definition_status_t success_function(btree_definition_tree_data_t *struct_tree)
{
    printf("success\n");
    btree_manager_reset_tree(struct_tree);
    self.need_tick = true;
    return BTREE_DEFINITION_STATUS_SUCCESS;
}

btree_definition_status_t fail_function(btree_definition_tree_data_t *struct_tree)
{
    printf("fail\n");
    btree_manager_reset_tree(struct_tree);
    self.need_tick = true;
    return BTREE_DEFINITION_STATUS_FAIL;
}

btree_definition_status_t standby_function(btree_definition_tree_data_t *struct_tree)
{
    printf("standby\n");
    return BTREE_DEFINITION_STATUS_STAND_BY;
}

void init_application()
{
    esp_err_t ret = nvs_flash_init();

    if (ret == ESP_ERR_NVS_NO_FREE_PAGES || ret == ESP_ERR_NVS_NEW_VERSION_FOUND) {
        ESP_ERROR_CHECK(nvs_flash_erase());
        ret = nvs_flash_init();
    }

    gpio_config_t io_conf = {.pin_bit_mask = (1ULL << LED_GPIO),
                             .mode         = GPIO_MODE_OUTPUT,
                             .pull_up_en   = GPIO_PULLUP_DISABLE,
                             .pull_down_en = GPIO_PULLDOWN_DISABLE,
                             .intr_type    = GPIO_INTR_DISABLE};
    gpio_config(&io_conf);

    while (1) {
        if (self.need_tick) {
            self.need_tick = false;
            btree_manager_tick(&btree_main_control, &self.fuctions_tree);
            printf("\n");
        }
        vTaskDelay(pdMS_TO_TICKS(1000));
    }
}
