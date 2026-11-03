/**
 * @file btree_main_wifi.h
 * @author Renilson Almeida (joserenilson.silva@edge.ufal.br)
 * @brief Header of interface of wifi tree.
 * @version 1.0
 * @date 10/05/2025
 *
 */

#ifndef BTREE_MAIN_WIFI_H_
#define BTREE_MAIN_WIFI_H_

#include "btree_main_blackboard.h"

/**
 * @brief
 *
 * @retval BTREE_DEFINITION_STATUS_SUCCESS case success;
 * @retval BTREE_DEFINITION_STATUS_FAIL case fail;
 */
btree_definition_status_t btree_main_wifi_is_connected(void);

/**
 * @brief
 *
 * @retval BTREE_DEFINITION_STATUS_SUCCESS case success;
 * @retval BTREE_DEFINITION_STATUS_FAIL case fail;
 */
btree_definition_status_t btree_main_wifi_is_fail(void);

/**
 * @brief
 *
 * @retval BTREE_DEFINITION_STATUS_SUCCESS case success;
 * @retval BTREE_DEFINITION_STATUS_FAIL case fail;
 * @retval BTREE_DEFINITION_STATUS_STAND_BY case waiting for something;
 */
btree_definition_status_t btree_main_wifi_ping(void);

/**
 * @brief
 *
 * @retval BTREE_DEFINITION_STATUS_SUCCESS case success;
 * @retval BTREE_DEFINITION_STATUS_FAIL case fail;
 * @retval BTREE_DEFINITION_STATUS_STAND_BY case waiting for something;
 */
btree_definition_status_t btree_main_wifi_wifi_init(void);

/**
 * @brief
 *
 * @retval BTREE_DEFINITION_STATUS_SUCCESS case success;
 * @retval BTREE_DEFINITION_STATUS_FAIL case fail;
 * @retval BTREE_DEFINITION_STATUS_STAND_BY case waiting for something;
 */
btree_definition_status_t btree_main_wifi_wifi_register(void);

/**
 * @brief
 *
 * @retval BTREE_DEFINITION_STATUS_SUCCESS case success;
 * @retval BTREE_DEFINITION_STATUS_FAIL case fail;
 * @retval BTREE_DEFINITION_STATUS_STAND_BY case waiting for something;
 */
btree_definition_status_t btree_main_wifi_wifi_connect(void);

/**
 * @brief
 *
 * @retval BTREE_DEFINITION_STATUS_SUCCESS case success;
 * @retval BTREE_DEFINITION_STATUS_FAIL case fail;
 * @retval BTREE_DEFINITION_STATUS_STAND_BY case waiting for something;
 */
btree_definition_status_t btree_main_wifi_clear_credentials(void);

/**
 * @brief Check if there are WiFi credentials (same check of the BLE tree).
 *
 * @retval BTREE_DEFINITION_STATUS_SUCCESS case there are credentials;
 * @retval BTREE_DEFINITION_STATUS_FAIL case there are no credentials;
 */
btree_definition_status_t btree_main_wifi_have_credentials(void);

/**
 * @brief
 *
 * @retval BTREE_DEFINITION_STATUS_SUCCESS case success;
 * @retval BTREE_DEFINITION_STATUS_FAIL case fail;
 * @retval BTREE_DEFINITION_STATUS_STAND_BY case waiting for something;
 */
btree_definition_status_t btree_main_wifi_wifi_disconnect(void);

/**
 * @brief
 *
 * @retval BTREE_DEFINITION_STATUS_SUCCESS case success;
 * @retval BTREE_DEFINITION_STATUS_FAIL case fail;
 * @retval BTREE_DEFINITION_STATUS_STAND_BY case waiting for something;
 */
btree_definition_status_t btree_main_wifi_wifi_unregister(void);

/**
 * @brief
 *
 * @retval BTREE_DEFINITION_STATUS_SUCCESS case success;
 * @retval BTREE_DEFINITION_STATUS_FAIL case fail;
 * @retval BTREE_DEFINITION_STATUS_STAND_BY case waiting for something;
 */
btree_definition_status_t btree_main_wifi_wifi_deinit(void);

#endif /* BTREE_MAIN_WIFI_H_ */