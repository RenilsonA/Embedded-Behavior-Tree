/**
 * @file btree_robot_delivery.h
 * @author Renilson Almeida (renilson.123@hotmail.com)
 * @brief Header of interface of delivery tree.
 * @version 1.0
 * @date 01/11/2026
 *
 * @copyright Copyright © 2026 Renilson Almeida. All rights reserved.
 *
 */

#ifndef BTREE_ROBOT_DELIVERY_H_
#define BTREE_ROBOT_DELIVERY_H_

#include "btree_robot_blackboard.h"

/**
* @brief 
*
* @retval BTREE_DEFINITION_STATUS_SUCCESS case success;
* @retval BTREE_DEFINITION_STATUS_FAIL case fail;
*/
btree_definition_status_t btree_robot_delivery_battery_ok(void);

/**
* @brief 
*
* @retval BTREE_DEFINITION_STATUS_SUCCESS case success;
* @retval BTREE_DEFINITION_STATUS_FAIL case fail;
* @retval BTREE_DEFINITION_STATUS_STAND_BY case waiting for something;
*/
btree_definition_status_t btree_robot_delivery_charge(void);

/**
* @brief 
*
* @retval BTREE_DEFINITION_STATUS_SUCCESS case success;
* @retval BTREE_DEFINITION_STATUS_FAIL case fail;
* @retval BTREE_DEFINITION_STATUS_STAND_BY case waiting for something;
*/
btree_definition_status_t btree_robot_delivery_open_door(void);

/**
* @brief 
*
* @retval BTREE_DEFINITION_STATUS_SUCCESS case success;
* @retval BTREE_DEFINITION_STATUS_FAIL case fail;
*/
btree_definition_status_t btree_robot_delivery_obstacle_detected(void);

/**
* @brief 
*
* @retval BTREE_DEFINITION_STATUS_SUCCESS case success;
* @retval BTREE_DEFINITION_STATUS_FAIL case fail;
* @retval BTREE_DEFINITION_STATUS_STAND_BY case waiting for something;
*/
btree_definition_status_t btree_robot_delivery_deliver_package(void);

#endif /* BTREE_ROBOT_DELIVERY_H_ */