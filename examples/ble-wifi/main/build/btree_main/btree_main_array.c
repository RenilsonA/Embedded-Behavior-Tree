/**
 * @file btree_main_array.c
 * @author Renilson Almeida (joserenilson.silva@edge.ufal.br)
 * @brief Interface of array tree.
 * @version 1.0
 * @date 02/11/2026
 *
 */

#include "btree_main_array.h"
#include "btree_main_main.h"
#include "btree_main_ble.h"
#include "btree_main_wifi.h"

/**
 * @brief Array containing the nodes of the main tree.
 *
 */
const btree_definition_node_t btree_main_array[BTREE_MAIN_ARRAY_SIZE] = 
{
        [0] = BTREE_DEFINITION_CREATE_NODE_ACTION_SLEEP(1, 8, BTREE_DEFINITION_TREE_UNRELATED, 1000), 
        [1] = BTREE_DEFINITION_CREATE_NODE_CONDITION(2, 8, BTREE_DEFINITION_TREE_UNRELATED, &btree_main_ble_have_credentials), 
        [2] = BTREE_DEFINITION_CREATE_NODE_FORCE_SUCCESS(12, 8, BTREE_DEFINITION_TREE_UNRELATED), 
        [3] = BTREE_DEFINITION_CREATE_NODE_INVERTER(2, 5, BTREE_DEFINITION_TREE_UNRELATED), 
        [4] = BTREE_DEFINITION_CREATE_NODE_CONDITION(3, 3, BTREE_DEFINITION_TREE_UNRELATED, &btree_main_ble_bluetooth_has_started), 
        [5] = BTREE_DEFINITION_CREATE_NODE_ACTION(6, 2, BTREE_DEFINITION_TREE_UNRELATED, &btree_main_ble_ble_deinit), 
        [6] = BTREE_DEFINITION_CREATE_NODE_ACTION(7, 2, BTREE_DEFINITION_TREE_UNRELATED, &btree_main_ble_ble_unregister), 
        [7] = BTREE_DEFINITION_CREATE_NODE_ACTION(2, 2, BTREE_DEFINITION_TREE_UNRELATED, &btree_main_ble_ble_disconnect), 
        [8] = BTREE_DEFINITION_CREATE_NODE_INVERTER(10, BTREE_DEFINITION_TREE_UNRELATED, BTREE_DEFINITION_TREE_UNRELATED), 
        [9] = BTREE_DEFINITION_CREATE_NODE_CONDITION(8, 8, BTREE_DEFINITION_TREE_UNRELATED, &btree_main_ble_bluetooth_has_started), 
        [10] = BTREE_DEFINITION_CREATE_NODE_ACTION(11, BTREE_DEFINITION_TREE_UNRELATED, BTREE_DEFINITION_TREE_UNRELATED, &btree_main_ble_ble_init), 
        [11] = BTREE_DEFINITION_CREATE_NODE_ACTION(12, BTREE_DEFINITION_TREE_UNRELATED, BTREE_DEFINITION_TREE_UNRELATED, &btree_main_ble_ble_register), 
        [12] = BTREE_DEFINITION_CREATE_NODE_CONDITION(BTREE_DEFINITION_TREE_UNRELATED, 13, BTREE_DEFINITION_TREE_UNRELATED, &btree_main_wifi_is_connected), 
        [13] = BTREE_DEFINITION_CREATE_NODE_FORCE_FAIL(BTREE_DEFINITION_TREE_UNRELATED, 19, BTREE_DEFINITION_TREE_UNRELATED), 
        [14] = BTREE_DEFINITION_CREATE_NODE_CONDITION(15, 13, BTREE_DEFINITION_TREE_UNRELATED, &btree_main_wifi_is_fail), 
        [15] = BTREE_DEFINITION_CREATE_NODE_ACTION(16, 13, BTREE_DEFINITION_TREE_UNRELATED, &btree_main_wifi_clear_credentials), 
        [16] = BTREE_DEFINITION_CREATE_NODE_ACTION(17, 13, BTREE_DEFINITION_TREE_UNRELATED, &btree_main_wifi_wifi_disconnect), 
        [17] = BTREE_DEFINITION_CREATE_NODE_ACTION(18, 13, BTREE_DEFINITION_TREE_UNRELATED, &btree_main_wifi_wifi_unregister), 
        [18] = BTREE_DEFINITION_CREATE_NODE_ACTION(13, 13, BTREE_DEFINITION_TREE_UNRELATED, &btree_main_wifi_wifi_deinit), 
        [19] = BTREE_DEFINITION_CREATE_NODE_CONDITION(20, BTREE_DEFINITION_TREE_UNRELATED, BTREE_DEFINITION_TREE_UNRELATED, &btree_main_wifi_have_credentials), 
        [20] = BTREE_DEFINITION_CREATE_NODE_ACTION(21, BTREE_DEFINITION_TREE_UNRELATED, BTREE_DEFINITION_TREE_UNRELATED, &btree_main_wifi_wifi_init), 
        [21] = BTREE_DEFINITION_CREATE_NODE_ACTION(22, BTREE_DEFINITION_TREE_UNRELATED, BTREE_DEFINITION_TREE_UNRELATED, &btree_main_wifi_wifi_register), 
        [22] = BTREE_DEFINITION_CREATE_NODE_ACTION(23, BTREE_DEFINITION_TREE_UNRELATED, BTREE_DEFINITION_TREE_UNRELATED, &btree_main_wifi_wifi_connect), 
        [23] = BTREE_DEFINITION_CREATE_NODE_ACTION_SLEEP(24, BTREE_DEFINITION_TREE_UNRELATED, BTREE_DEFINITION_TREE_UNRELATED, 2000), 
        [24] = BTREE_DEFINITION_CREATE_NODE_ACTION(BTREE_DEFINITION_TREE_UNRELATED, BTREE_DEFINITION_TREE_UNRELATED, BTREE_DEFINITION_TREE_UNRELATED, &btree_main_wifi_ping), 
};

#if BTREE_COMMON_DEBUG
/**
 * @brief Array containing the debug string names of the nodes of main tree.
 *
 */
static const char * const btree_main_array_debug[BTREE_MAIN_ARRAY_SIZE] = 
{
        NULL,
        "btree_main_ble_have_credentials",
        NULL,
        NULL,
        "btree_main_ble_bluetooth_has_started",
        "btree_main_ble_ble_deinit",
        "btree_main_ble_ble_unregister",
        "btree_main_ble_ble_disconnect",
        NULL,
        "btree_main_ble_bluetooth_has_started",
        "btree_main_ble_ble_init",
        "btree_main_ble_ble_register",
        "btree_main_wifi_is_connected",
        NULL,
        "btree_main_wifi_is_fail",
        "btree_main_wifi_clear_credentials",
        "btree_main_wifi_wifi_disconnect",
        "btree_main_wifi_wifi_unregister",
        "btree_main_wifi_wifi_deinit",
        "btree_main_wifi_have_credentials",
        "btree_main_wifi_wifi_init",
        "btree_main_wifi_wifi_register",
        "btree_main_wifi_wifi_connect",
        NULL,
        "btree_main_wifi_ping",
};

/**
 * @brief Struct of debug information of the main tree.
 *
 */
static const btree_definition_debug_t btree_main_debug_item = {
    .tree_name = "MAIN",
    .functions_name = btree_main_array_debug,
};
#endif

/**
 * @brief main tree Control Structure.
 *
 */
btree_definition_tree_data_t btree_main_control = {
    .last_node_state = BTREE_DEFINITION_STATUS_RUNNING,
    .node_index      = BTREE_DEFINITION_NODE_FIRST_INDEX,
    .tree_size       = BTREE_MAIN_ARRAY_SIZE,
    .tick_index      = BTREE_DEFINITION_TREE_UNRELATED,
    .array_attempts  = NULL,
    .tree            = btree_main_array,
#if BTREE_COMMON_DEBUG
    .debug           = &btree_main_debug_item,
#else
    .debug           = NULL,
#endif
};

