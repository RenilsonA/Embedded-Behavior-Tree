/**
 * @file btree_main_ble.h
 * @author Renilson Almeida (joserenilson.silva@edge.ufal.br)
 * @brief Header of interface of ble tree.
 * @version 1.0
 * @date 18/05/2025
 *
 */

#ifndef BTREE_MAIN_BLE_H_
#define BTREE_MAIN_BLE_H_

#include "btree_main_blackboard.h"

/**
 * @brief
 *
 * @retval BTREE_DEFINITION_STATUS_SUCCESS case success;
 * @retval BTREE_DEFINITION_STATUS_FAIL case fail;
 */
btree_definition_status_t btree_main_ble_bluetooth_has_started(void);

/**
 * @brief
 *
 * @retval BTREE_DEFINITION_STATUS_SUCCESS case success;
 * @retval BTREE_DEFINITION_STATUS_FAIL case fail;
 * @retval BTREE_DEFINITION_STATUS_STAND_BY case waiting for something;
 */
btree_definition_status_t btree_main_ble_ble_init(void);

/**
 * @brief
 *
 * @retval BTREE_DEFINITION_STATUS_SUCCESS case success;
 * @retval BTREE_DEFINITION_STATUS_FAIL case fail;
 * @retval BTREE_DEFINITION_STATUS_STAND_BY case waiting for something;
 */
btree_definition_status_t btree_main_ble_ble_register(void);

#endif /* BTREE_MAIN_BLE_H_ */