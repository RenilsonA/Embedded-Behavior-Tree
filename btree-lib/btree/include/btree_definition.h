/**
 * @file btree_definition.h
 * @author Renilson Almeida (renilson.123@hotmail.com)
 * @brief Header of behavior tree definitions.
 * @version 1.0
 * @date 26/06/24
 *
 * @copyright Copyright (c) 2024 Renilson Almeida
 *
 * Permission is hereby granted, free of charge, to any person obtaining a copy
 * of this software and associated documentation files (the "Software"), to deal
 * in the Software without restriction, including without limitation the rights
 * to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
 * copies of the Software, and to permit persons to whom the Software is
 * furnished to do so, subject to the following conditions:
 *
 * The above copyright notice and this permission notice shall be included in
 * all copies or substantial portions of the Software.
 *
 * THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
 * IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
 * FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
 * AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
 * LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
 * OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
 * SOFTWARE.
 */

#ifndef BTREE_DEFINITION_H_
#define BTREE_DEFINITION_H_

#include "stddef.h"
#include "stdint.h"

/**
 * @brief Define bits size of tree indexes.
 *
 */
#define BTREE_DEFINITION_SIZE 8

/**
 * @brief Define type of indexes.
 * Type index of 32-bit, 16-bit 8-bit value, respectively.
 *
 */
#if BTREE_DEFINITION_SIZE == 32
typedef uint32_t btree_index_t;
#elif BTREE_DEFINITION_SIZE == 16
typedef uint16_t btree_index_t;
#else
typedef uint8_t btree_index_t;
#endif

/**
 * @brief Non-existing item.
 * Last ID of 32-bit, 16-bit 8-bit value, respectively.
 *
 */
#if BTREE_DEFINITION_SIZE == 32
#define BTREE_DEFINITION_TREE_UNRELATED 0xFFFFFFFF
#elif BTREE_DEFINITION_SIZE == 16
#define BTREE_DEFINITION_TREE_UNRELATED 0xFFFF
#else
#define BTREE_DEFINITION_TREE_UNRELATED 0xFF
#endif

/**
 * @brief Index of first node.
 *
 */
#define BTREE_DEFINITION_NODE_FIRST_INDEX 0

/**
 * @brief Error checking a function of type btree_definition_status_t.
 *
 */
#define BTREE_DEFINITION_TREE_STATUS(_err)                                     \
  do {                                                                         \
    if (_err) {                                                                \
      return BTREE_DEFINITION_STATUS_FAIL;                                     \
    }                                                                          \
    return BTREE_DEFINITION_STATUS_SUCCESS;                                    \
  } while (0)

/**
 * @brief Enumerates the types of tree returns.
 *
 */
typedef enum {
  BTREE_DEFINITION_STATUS_RUNNING = 0, /**< Status running in node or tree. */
  BTREE_DEFINITION_STATUS_SUCCESS,     /**< Status success in node or tree. */
  BTREE_DEFINITION_STATUS_FAIL,        /**< Status failed in node or tree. */
  BTREE_DEFINITION_STATUS_RE_EXECUTE, /**< Status of new re-execution in node or
                                         tree. */
  BTREE_DEFINITION_STATUS_STAND_BY,   /**< Status stand by in actions nodes. */
  BTREE_DEFINITION_STATUS_ERROR,      /**< Status error in node or tree. */
  __BTREE_DEFINITION_STATUS_AMOUNT,   /**< Status amount in lib. */
} btree_definition_status_t;

/**
 * @brief Enumerates the types of nodes in the tree.
 *
 */
typedef enum {
  BTREE_DEFINITION_NODE_CONDITION =
      0,                        /**< Type of interaction condition node. */
  BTREE_DEFINITION_NODE_ACTION, /**< Type of interaction action node. */
  BTREE_DEFINITION_NODE_ACTION_SLEEP, /**< Type of interaction action timeout
                                           node. */
  BTREE_DEFINITION_NODE_RETRY_UNTIL_SUCCESS, /**< Type of decorator type retry
                                                until success. */
  BTREE_DEFINITION_NODE_REPEAT, /**< Type of decorator type repeat. */
  BTREE_DEFINITION_NODE_KEEP_RUNNING_UNTIL_SUCCESS, /**< Type of decorator type
                                                       keep running until
                                                       success. */
  BTREE_DEFINITION_NODE_INVERTER,      /**< Type of decorator type inverter. */
  BTREE_DEFINITION_NODE_FORCE_SUCCESS, /**< Type of decorator type force
                                          success. */
  BTREE_DEFINITION_NODE_FORCE_FAIL, /**< Type of decorator type force fail. */
  BTREE_DEFINITION_NODE_REACTIVE_NODES =
      0x10, /**< Type of decorator type timeout. */
  BTREE_DEFINITION_NODE_REACTIVE_CONDITION,    /**< Type of reactive interaction
                                                  condition node. */
  BTREE_DEFINITION_NODE_REACTIVE_ACTION,       /**< Type of reactive interaction
                                                  action node. */
  BTREE_DEFINITION_NODE_REACTIVE_ACTION_SLEEP, /**< Type of reactive
                                                    interaction action timeout
                                                    node. */
  BTREE_DEFINITION_NODE_REACTIVE_RETRY_UNTIL_SUCCESS, /**< Type of reactive
                                                         decorator type retry
                                                         until success. */
  BTREE_DEFINITION_NODE_REACTIVE_REPEAT, /**< Type of reactive decorator type
                                            repeat. */
  BTREE_DEFINITION_NODE_REACTIVE_KEEP_RUNNING_UNTIL_SUCCESS, /**< Type of
                                                                reactive
                                                                decorator type
                                                                keep running
                                                                until success.
                                                              */
  BTREE_DEFINITION_NODE_REACTIVE_INVERTER, /**< Type of reactive decorator type
                                              inverter. */
  BTREE_DEFINITION_NODE_REACTIVE_FORCE_SUCCESS, /**< Type of reactive decorator
                                                   type force success. */
  BTREE_DEFINITION_NODE_REACTIVE_FORCE_FAIL,    /**< Type of reactive decorator
                                                   type force fail. */
  __BTREE_DEFINITION_NODE_AMOUNT,               /**< Amount of nodes. */
} btree_definition_node_type_t;

/**
 * @brief Data loaded into decorator type node.
 *
 */
typedef struct btree_definition_node_decorator {
  btree_index_t node_limit; /**< Last node limit with retry decorators. */
  uint16_t times;           /**< Times of retry ramification. */
  uint8_t index;            /**< Local of memory buffer to save retry number. */
} btree_definition_node_decorator_t;

/**
 * @brief Data loaded into interaction node.
 *
 */
typedef struct btree_definition_node_interaction {
  union {
    btree_definition_status_t (*function)(
        void);           /**< Pointer to interaction function. */
    uint32_t timeout_ms; /**< Delay timeout value for interaction action
                              node delay. */
  };
} btree_definition_node_interaction_t;

/**
 * @brief Structure of a tree node.
 *
 */
typedef struct btree_definition_node {
  btree_definition_node_type_t node_type; /**< Node type. */
  btree_index_t st_index; /**< Index to next node struture if have success. */
  btree_index_t ft_index; /**< Index to next node struture if have fail. */
  union {
    btree_definition_node_interaction_t
        interaction_node; /**< interaction type node. */
    btree_definition_node_decorator_t
        decorator_node; /**< Decorator type node. */
  };
} btree_definition_node_t;

/**
 * @brief Structure of debug tree.
 * 
 */
typedef struct btree_definition_debug {
  const char *tree_name;                     /**< Name of tree. */
  const char **functions_name;               /**< Name of function. */
} btree_definition_debug_t;

/**
 * @brief Structure of relevant items of a tree.
 *
 */
typedef struct btree_definition_tree_data {
  btree_definition_status_t last_node_state; /**< State of tree execution. */
  btree_index_t node_index;                  /**< Node to be executed. */
  btree_index_t tree_size;                   /**< Size of tree. */
  uint32_t *nodes_status;                    /**< Pointer to status of nodes. */
  uint32_t *array_attempts;                  /**< Pointer to attempts array. */
  const btree_definition_node_t *tree;       /**< Pointer to tree. */
  const btree_definition_debug_t *debug;     /**< Pointer to debug items. */
} btree_definition_tree_data_t;

/**
 * @brief Struct of functions to ticks.
 *
 */
typedef struct btree_definition_config_functions {
  btree_definition_status_t (*function_tick)(
      btree_definition_tree_data_t *); /**< Pointer to function tick tipe. */
  btree_definition_status_t (*running_case)(
      btree_definition_tree_data_t
          *); /**< Pointer to function of running case. */
  btree_definition_status_t (*success_case)(
      btree_definition_tree_data_t
          *); /**< Pointer to function of success case. */
  btree_definition_status_t (*fail_case)(
      btree_definition_tree_data_t *); /**< Pointer to function of fail case. */
  btree_definition_status_t (*standby_case)(
      btree_definition_tree_data_t
          *); /**< Pointer to function of standby case. */
} btree_definition_config_functions_t;

/**
 * @brief Macro that creates condition node condition.
 *
 */
#define BTREE_DEFINITION_CREATE_NODE_CONDITION(_success_target, _fail_target,  \
                                               _function)                      \
  {                                                                            \
    .node_type = BTREE_DEFINITION_NODE_CONDITION, .st_index = _success_target, \
    .ft_index = _fail_target, .interaction_node.function = _function,          \
  }

/**
 * @brief Macro that creates action node common.
 *
 */
#define BTREE_DEFINITION_CREATE_NODE_ACTION(_success_target, _fail_target,     \
                                            _function)                         \
  {                                                                            \
    .node_type = BTREE_DEFINITION_NODE_ACTION, .st_index = _success_target,    \
    .ft_index = _fail_target, .interaction_node.function = _function,          \
  }

/**
 * @brief Macro that creates action sleep node.
 *
 */
#define BTREE_DEFINITION_CREATE_NODE_ACTION_SLEEP(_success_target,             \
                                                  _fail_target, _time_ms)      \
  {                                                                            \
    .node_type = BTREE_DEFINITION_NODE_ACTION_SLEEP,                           \
    .st_index = _success_target, .ft_index = _fail_target,                     \
    .interaction_node.timeout_ms = _time_ms,                                   \
  }

/**
 * @brief Macro that creates retry until success node.
 *
 */
#define BTREE_DEFINITION_CREATE_NODE_RETRY_UNTIL_SUCCESS(                      \
    _success_target, _fail_target, _attempts, _index, _node_limit)             \
  {                                                                            \
    .node_type = BTREE_DEFINITION_NODE_RETRY_UNTIL_SUCCESS,                    \
    .st_index = _success_target, .ft_index = _fail_target,                     \
    .decorator_node.node_limit = _node_limit,                                  \
    .decorator_node.times = _attempts, .decorator_node.index = _index,         \
  }

/**
 * @brief Macro that creates repeat node.
 *
 */
#define BTREE_DEFINITION_CREATE_NODE_REPEAT(_success_target, _fail_target,     \
                                            _times, _local, _node_limit)       \
  {                                                                            \
    .node_type = BTREE_DEFINITION_NODE_REPEAT, .st_index = _success_target,    \
    .decorator_node.ties_node.node_limit = _node_limit,                        \
    .decorator_node.ties_node.times = _times,                                  \
    .decorator_node.ties_node.local = _local,                                  \
  }

/**
 * @brief Macro that creates keep running until failure node.
 *
 */
#define BTREE_DEFINITION_CREATE_NODE_KEEP_RUNNING_UNTIL_FAILURE(               \
    _success_target, _fail_target, _node_limit)                                \
  {                                                                            \
    .node_type = BTREE_DEFINITION_NODE_KEEP_RUNNING_UNTIL_SUCCESS,             \
    .st_index = _success_target, .ft_index = _fail_target,                     \
    .decorator_node.node_limit = _node_limit,                                  \
  }

/**
 * @brief Macro that creates inverter node.
 *
 */
#define BTREE_DEFINITION_CREATE_NODE_INVERTER(_success_target, _fail_target)   \
  {                                                                            \
    .node_type = BTREE_DEFINITION_NODE_INVERTER, .st_index = _success_target,  \
    .ft_index = _fail_target,                                                  \
  }

/**
 * @brief Macro that creates force success node.
 *
 */
#define BTREE_DEFINITION_CREATE_NODE_FORCE_SUCCESS(_success_target,            \
                                                   _fail_target)               \
  {                                                                            \
    .node_type = BTREE_DEFINITION_NODE_FORCE_SUCCESS,                          \
    .st_index = _success_target, .ft_index = _fail_target,                     \
  }

/**
 * @brief Macro that creates force fail node.
 *
 */
#define BTREE_DEFINITION_CREATE_NODE_FORCE_FAIL(_success_target, _fail_target) \
  {                                                                            \
    .node_type = BTREE_DEFINITION_NODE_FORCE_FAIL,                             \
    .st_index = _success_target, .ft_index = _fail_target,                     \
  }

/**
 * @brief Macro that creates condition reactive node.
 *
 */
#define BTREE_DEFINITION_CREATE_NODE_REACTIVE_CONDITION(                       \
    _success_target, _fail_target, _function)                                  \
  {                                                                            \
    .node_type = BTREE_DEFINITION_NODE_REACTIVE_CONDITION,                     \
    .st_index = _success_target, .ft_index = _fail_target,                     \
    .interaction_node.function = _function,                                    \
  }

/**
 * @brief Macro that creates action reactive node.
 *
 */
#define BTREE_DEFINITION_CREATE_NODE_REACTIVE_ACTION(_success_target,          \
                                                     _fail_target, _function)  \
  {                                                                            \
    .node_type = BTREE_DEFINITION_NODE_REACTIVE_ACTION,                        \
    .st_index = _success_target, .ft_index = _fail_target,                     \
    .interaction_node.function = _function,                                    \
  }

/**
 * @brief Macro that creates reactive action sleep node.
 *
 */
#define BTREE_DEFINITION_CREATE_NODE_REACTIVE_ACTION_SLEEP(                    \
    _success_target, _fail_target, _time_ms)                                   \
  {                                                                            \
    .node_type = BTREE_DEFINITION_NODE_REACTIVE_ACTION_SLEEP,                  \
    .st_index = _success_target, .ft_index = _fail_target,                     \
    .interaction_node.timeout_ms = _time_ms,                                   \
  }

/**
 * @brief Macro that creates retry until success reactive node.
 *
 */
#define BTREE_DEFINITION_CREATE_NODE_REACTIVE_RETRY_UNTIL_SUCCESS(             \
    _success_target, _fail_target, _attempts, _index, _node_limit)             \
  {                                                                            \
    .node_type = BTREE_DEFINITION_NODE_REACTIVE_RETRY_UNTIL_SUCCESS,           \
    .st_index = _success_target, .ft_index = _fail_target,                     \
    .decorator_node.node_limit = _node_limit,                                  \
    .decorator_node.times = _attempts, .decorator_node.index = _index,         \
  }

/**
 * @brief Macro that creates repeat reactive node.
 *
 */
#define BTREE_DEFINITION_CREATE_NODE_REACTIVE_REPEAT(                          \
    _success_target, _fail_target, _times, _index, _node_limit)                \
  {                                                                            \
    .node_type = BTREE_DEFINITION_NODE_REACTIVE_REPEAT,                        \
    .st_index = _success_target, .ft_index = _fail_target,                     \
    .decorator_node.node_limit = _node_limit, .decorator_node.times = _times,  \
    .decorator_node.index = _index,                                            \
  }

/**
 * @brief Macro that creates keep running until failure reactive node.
 *
 */
#define BTREE_DEFINITION_CREATE_NODE_REACTIVE_KEEP_RUNNING_UNTIL_FAILURE(      \
    _success_target, _fail_target, _node_limit)                                \
  {                                                                            \
    .node_type = BTREE_DEFINITION_NODE_REACTIVE_KEEP_RUNNING_UNTIL_SUCCESS,    \
    .st_index = _success_target, .ft_index = _fail_target,                     \
    .decorator_node.ties_node.node_limit = _node_limit,                        \
  }

/**
 * @brief Macro that creates inverter reactive node.
 *
 */
#define BTREE_DEFINITION_CREATE_NODE_REACTIVE_INVERTER(_success_target,        \
                                                       _fail_target)           \
  {                                                                            \
    .node_type = BTREE_DEFINITION_NODE_REACTIVE_INVERTER,                      \
    .st_index = _success_target, .ft_index = _fail_target,                     \
  }

/**
 * @brief Macro that creates force success reactive node.
 *
 */
#define BTREE_DEFINITION_CREATE_NODE_REACTIVE_FORCE_SUCCESS(_success_target,   \
                                                            _fail_target)      \
  {                                                                            \
    .node_type = BTREE_DEFINITION_NODE_REACTIVE_FORCE_SUCCESS,                 \
    .st_index = _success_target, .ft_index = _fail_target,                     \
  }

/**
 * @brief Macro that creates force fail reactive node.
 *
 */
#define BTREE_DEFINITION_CREATE_NODE_REACTIVE_FORCE_FAIL(_success_target,      \
                                                         _fail_target)         \
  {                                                                            \
    .node_type = BTREE_DEFINITION_NODE_REACTIVE_FORCE_FAIL,                    \
    .st_index = _success_target, .ft_index = _fail_target,                     \
  }

#endif /* BTREE_DEFINITION_H_ */
