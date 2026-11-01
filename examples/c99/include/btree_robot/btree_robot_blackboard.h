/**
 * @file btree_robot_blackboard.h
 * @author Renilson Almeida (renilson.123@hotmail.com)
 * @brief Blackboard interface header.
 * @version 1.0
 * @date 01/11/2026
 *
 * @copyright Copyright © 2026 Renilson Almeida. All rights reserved.
 *
 */

#ifndef BTREE_ROBOT_BLACKBOARD_H_
#define BTREE_ROBOT_BLACKBOARD_H_

#include "btree_robot_common.h"
#include <stdbool.h>
#include <stdint.h>

/**
 * @brief Blackboard robot tree struct.
 * 
 */
struct btree_robot_blackboard {
    uint8_t battery_percent;  /**< Battery level, 0-100 %. */
    uint8_t charge_ticks;     /**< Ticks spent on the charger in this charge. */
    uint8_t door_attempts;    /**< Times open_door was tried in this delivery. */
    bool obstacle_ahead;      /**< Simulated distance sensor. */
    uint16_t delivered;       /**< Packages delivered so far. */
};

/**
 * @brief Structure with relevant data from the robot tree blackboard.
 * 
 */
extern struct btree_robot_blackboard btree_robot_data;

/**
 * @brief Clear all blackboard data from the robot tree.
 * 
 */
void btree_robot_reset_blackboard(void);

#endif /* BTREE_ROBOT_BLACKBOARD_H_ */
