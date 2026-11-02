#include <stdbool.h>
#include <stdio.h>
#include <stdlib.h>

#include "btree_manager.h"
#include "btree_robot_array.h"
#include "btree_robot_blackboard.h"

#define MAX_TICKS_PER_DELIVERY 100

#define STAND_BY_WAIT_MS 100u

static bool delivery_finished = false;

static btree_definition_status_t on_running(btree_definition_tree_data_t *tree)
{
    (void) tree;
    return BTREE_DEFINITION_STATUS_RUNNING;
}

static btree_definition_status_t on_stand_by(btree_definition_tree_data_t *tree)
{
    (void) tree;
    (void) btree_common_delay_ms(STAND_BY_WAIT_MS);
    return BTREE_DEFINITION_STATUS_STAND_BY;
}

static btree_definition_status_t on_success(btree_definition_tree_data_t *tree)
{
    printf("tree finished: SUCCESS\n");
    btree_manager_reset_tree(tree);
    delivery_finished = true;
    return BTREE_DEFINITION_STATUS_SUCCESS;
}

static btree_definition_status_t on_fail(btree_definition_tree_data_t *tree)
{
    printf("tree finished: FAIL\n");
    btree_manager_reset_tree(tree);
    delivery_finished = true;
    return BTREE_DEFINITION_STATUS_FAIL;
}

static btree_definition_config_functions_t callbacks = {
    .function_tick = btree_manager_tick_tree,
    .running_case  = on_running,
    .success_case  = on_success,
    .fail_case     = on_fail,
    .standby_case  = on_stand_by,
};

int main(int argc, char **argv)
{
    int delivery;
    unsigned long tick_ms = (argc > 1) ? strtoul(argv[1], NULL, 10) : 0ul;

    /* Line buffered even through a pipe, so each [BTREE] line reaches the Studio at once.
     */
    (void) setvbuf(stdout, NULL, _IOLBF, BUFSIZ);

    for (delivery = 1; delivery <= 3; delivery++) {
        int ticks = 0;

        btree_robot_data.obstacle_ahead = (delivery == 3);

        printf("\n=== delivery %d ===\n", delivery);
        delivery_finished = false;

        while (!delivery_finished && (ticks < MAX_TICKS_PER_DELIVERY)) {
            btree_manager_tick(&btree_robot_control, &callbacks);
            ticks++;
            if (tick_ms > 0ul) {
                (void) btree_common_delay_ms((uint32_t) tick_ms);
            }
        }
    }

    printf("\npackages delivered: %u\n", (unsigned) btree_robot_data.delivered);
    return 0;
}
