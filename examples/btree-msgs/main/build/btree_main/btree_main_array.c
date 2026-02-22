/**
 * @file btree_main_array.c
 * @author Renilson Almeida (joserenilson.silva@edge.ufal.br)
 * @brief Interface of array tree.
 * @version 1.0
 * @date 18/05/2025
 *
 */

#include "btree_main_array.h"
#include "btree_main_main_ble.h"
#include "btree_main_ble.h"

/**
 * @brief Array containing the nodes of the main tree.
 *
 */
const btree_definition_node_t btree_main_array[BTREE_MAIN_ARRAY_SIZE] = 
{
         [0] = BTREE_DEFINITION_CREATE_NODE_CONDITION(3, 1, &btree_main_ble_bluetooth_has_started), \
         [1] = BTREE_DEFINITION_CREATE_NODE_ACTION(2, BTREE_DEFINITION_TREE_UNRELATED, &btree_main_ble_ble_init), \
         [2] = BTREE_DEFINITION_CREATE_NODE_ACTION(3, BTREE_DEFINITION_TREE_UNRELATED, &btree_main_ble_ble_register), \
         [3] = BTREE_DEFINITION_CREATE_NODE_REACTIVE_CONDITION(6, 4, &btree_main_main_ble_not_recv_blinky_msg), \
         [4] = BTREE_DEFINITION_CREATE_NODE_ACTION(5, BTREE_DEFINITION_TREE_UNRELATED, &btree_main_main_ble_blynk_led), \
         [5] = BTREE_DEFINITION_CREATE_NODE_ACTION(6, BTREE_DEFINITION_TREE_UNRELATED, &btree_main_main_ble_just_standby), \
         [6] = BTREE_DEFINITION_CREATE_NODE_REACTIVE_CONDITION(BTREE_DEFINITION_TREE_UNRELATED, 7, &btree_main_main_ble_is_not_recv_echo_msg), \
         [7] = BTREE_DEFINITION_CREATE_NODE_REACTIVE_ACTION(BTREE_DEFINITION_TREE_UNRELATED, BTREE_DEFINITION_TREE_UNRELATED, &btree_main_main_ble_print_msg), \
};

/**
 * @brief main tree Control Structure.
 *
 */
btree_definition_tree_data_t btree_main_control = {
    .last_node_state = BTREE_DEFINITION_STATUS_RUNNING,
    .node_index      = BTREE_DEFINITION_NODE_FIRST_INDEX,
    .tree_size       = BTREE_MAIN_ARRAY_SIZE,
    .nodes_status    = btree_main_status_nodes,
    .array_attempts  = btree_main_common_attempts,
    .tree            = btree_main_array,
};

