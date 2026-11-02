/***************************************************************************/ /**
                                                                               * @file
                                                                               * @brief
                                                                               *Top level
                                                                               *application
                                                                               *functions
                                                                               *******************************************************************************
                                                                               * # License
                                                                               * <b>Copyright
                                                                               *2020
                                                                               *Silicon
                                                                               *Laboratories
                                                                               *Inc.
                                                                               *www.silabs.com</b>
                                                                               *******************************************************************************
                                                                               *
                                                                               * The
                                                                               *licensor
                                                                               *of this
                                                                               *software
                                                                               *is Silicon
                                                                               *Laboratories
                                                                               *Inc. Your
                                                                               *use of
                                                                               *this
                                                                               * software
                                                                               *is
                                                                               *governed
                                                                               *by the
                                                                               *terms of
                                                                               *Silicon
                                                                               *Labs
                                                                               *Master
                                                                               *Software
                                                                               *License
                                                                               * Agreement
                                                                               *(MSLA)
                                                                               *available
                                                                               *at
                                                                               * www.silabs.com/about-us/legal/master-software-license-agreement.
                                                                               *This
                                                                               * software
                                                                               *is
                                                                               *distributed
                                                                               *to you in
                                                                               *Source
                                                                               *Code
                                                                               *format and
                                                                               *is
                                                                               *governed
                                                                               *by the
                                                                               * sections
                                                                               *of the
                                                                               *MSLA
                                                                               *applicable
                                                                               *to Source
                                                                               *Code.
                                                                               *
                                                                               ******************************************************************************/

/***************************************************************************/ /**
                                                                               * Initialize
                                                                               *application.
                                                                               ******************************************************************************/
#include "btree_main_array.h"
#include "btree_manager.h"

bool need_tick = true;

btree_definition_status_t running_function(btree_definition_tree_data_t *struct_tree)
{
    need_tick = true;
    return BTREE_DEFINITION_STATUS_RUNNING;
}

btree_definition_status_t success_function(btree_definition_tree_data_t *struct_tree)
{
    SEGGER_RTT_printf(0, "success\n");
    btree_manager_reset_tree(struct_tree);
    need_tick = true;
    return BTREE_DEFINITION_STATUS_SUCCESS;
}

btree_definition_status_t fail_function(btree_definition_tree_data_t *struct_tree)
{
    SEGGER_RTT_printf(0, "fail\n");
    btree_manager_reset_tree(struct_tree);
    need_tick = true;
    return BTREE_DEFINITION_STATUS_FAIL;
}

btree_definition_status_t standby_function(btree_definition_tree_data_t *struct_tree)
{
    SEGGER_RTT_printf(0, "standby\n");
    return BTREE_DEFINITION_STATUS_STAND_BY;
}

void app_init(void)
{
    btree_definition_config_functions_t fuctions_tree = {
        .function_tick = btree_manager_tick_tree,
        .running_case  = running_function,
        .success_case  = success_function,
        .fail_case     = fail_function,
        .standby_case  = standby_function,
    };

    while (1) {
        if (need_tick) {
            need_tick = false;
            btree_manager_tick(&btree_main_control, &fuctions_tree);
            SEGGER_RTT_printf(0, "\n");
            sl_sleeptimer_delay_millisecond(200);
        }
    }
}

/***************************************************************************/ /**
                                                                               * App
                                                                               *ticking
                                                                               *function.
                                                                               ******************************************************************************/
void app_process_action(void)
{
}
