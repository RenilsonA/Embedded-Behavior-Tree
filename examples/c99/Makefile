# C99 example: builds with any C99 compiler, using btree-lib straight from the repository.
#   make            build ./delivery
#   make run        build and run
#   make DEBUG=0    build without the [BTREE] log

CC     ?= cc
DEBUG  ?= 1
LIB    := ../../btree-lib/btree

CFLAGS ?= -std=c99 -Wall -Wextra -O2
CFLAGS += -DBTREE_COMMON_DEBUG=$(DEBUG)
CFLAGS += -I$(LIB)/include -Itools/btree_robot -Iinclude/btree_robot

SRCS := main.c btree_port.c \
        $(wildcard $(LIB)/src/*.c) \
        $(wildcard tools/btree_robot/*.c) \
        $(wildcard src/btree_robot/*.c)

delivery: $(SRCS)
	$(CC) $(CFLAGS) $(SRCS) -o $@

run: delivery
	./delivery

clean:
	rm -f delivery

.PHONY: run clean
