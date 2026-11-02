#Behavior Tree like Tree.
POSITION_NODE_INDEX = 0
POSITION_NODE_TYPE = 1
POSITION_NODE_CHILDREN = 2
POSITION_NODE_SIBLING = -3
POSITION_NODE_PARENT = -2
POSITION_NODE_REACTIVE = -1
POSITION_NODE_FUNCTION = 2
POSITION_NODE_TARGET = 4
POSITION_NODE_SLEEP = 2
POSITION_NODE_DECORATOR_POINTER = 2
POSITION_NODE_DECORATOR_TARGET = -3
POSITION_NODE_DECORATOR_NUM_ATTEMPTS = 3
POSITION_NODE_DECORATOR_RETRY_DEPTH = -4

#Tree like DAG
INDEX_OF_POSITION = 0
INDEX_OF_MACRO = 1
INDEX_SUCCESS_CASE = 2
INDEX_FAIL_CASE = 3
INDEX_POINTER_VERIFY = -1
INDEX_CLEAN_UNTIL_NODE = -1
INDEX_REACTIVE = 4

#Node invalid
NODE_UNRELATED = "BTREE_DEFINITION_TREE_UNRELATED"

#Macros of nodes
macro_node_condition = "BTREE_DEFINITION_CREATE_NODE_CONDITION"
macro_node_action = "BTREE_DEFINITION_CREATE_NODE_ACTION"
macro_node_sleep = "BTREE_DEFINITION_CREATE_NODE_ACTION_SLEEP"
macro_node_retry_until_success = "BTREE_DEFINITION_CREATE_NODE_RETRY_UNTIL_SUCCESS"
macro_node_repeat = "BTREE_DEFINITION_CREATE_NODE_REPEAT"
macro_node_keep_running_until_failure = "BTREE_DEFINITION_CREATE_NODE_KEEP_RUNNING_UNTIL_FAILURE"
macro_node_force_failure = "BTREE_DEFINITION_CREATE_NODE_FORCE_FAIL"
macro_node_force_success = "BTREE_DEFINITION_CREATE_NODE_FORCE_SUCCESS"
macro_node_inverter = "BTREE_DEFINITION_CREATE_NODE_INVERTER"

macro_node_reactive_condition = "BTREE_DEFINITION_CREATE_NODE_REACTIVE_CONDITION"
macro_node_reactive_action = "BTREE_DEFINITION_CREATE_NODE_REACTIVE_ACTION"
macro_node_reactive_sleep = "BTREE_DEFINITION_CREATE_NODE_REACTIVE_ACTION_SLEEP"
macro_node_reactive_retry_until_success = "BTREE_DEFINITION_CREATE_NODE_REACTIVE_RETRY_UNTIL_SUCCESS"
macro_node_reactive_repeat = "BTREE_DEFINITION_CREATE_NODE_REACTIVE_REPEAT"
macro_node_reactive_keep_running_until_failure = "BTREE_DEFINITION_CREATE_NODE_REACTIVE_KEEP_RUNNING_UNTIL_FAILURE"
macro_node_reactive_force_failure = "BTREE_DEFINITION_CREATE_NODE_REACTIVE_FORCE_FAIL"
macro_node_reactive_force_success = "BTREE_DEFINITION_CREATE_NODE_REACTIVE_FORCE_SUCCESS"
macro_node_reactive_inverter = "BTREE_DEFINITION_CREATE_NODE_REACTIVE_INVERTER"

reactive_macro = {
    macro_node_condition: macro_node_reactive_condition,
    macro_node_action: macro_node_reactive_action,
    macro_node_sleep: macro_node_reactive_sleep,
    macro_node_retry_until_success: macro_node_reactive_retry_until_success,
    macro_node_repeat: macro_node_reactive_repeat,
    macro_node_keep_running_until_failure: macro_node_reactive_keep_running_until_failure,
    macro_node_force_failure: macro_node_reactive_force_failure,
    macro_node_force_success: macro_node_reactive_force_success,
    macro_node_inverter: macro_node_reactive_inverter,
}

#Status of nodes
status_node = [ 'success', 'fail']
status_fail = 'fail'
status_success = 'success'
status_running = 'Running'

class BTREE_EXECUTE:
    def __init__(self):
        self.node_root = 'Root'
        self.node_sequence = 'Sequence'
        self.node_fallback = 'Fallback'
        self.node_reactive_sequence = 'ReactiveSequence'
        self.node_reactive_fallback = 'ReactiveFallback'
        self.node_action = 'Script'
        self.node_condition = 'ScriptCondition'
        self.node_subtree = 'SubTree'
        self.tree_status = status_running
        self.node_decorator_retry_until_successful = 'RetryUntilSuccessful'
        self.node_decorator_repeat = 'Repeat'
        self.node_decorator_keep_running_until_failure = 'KeepRunningUntilFailure'
        self.node_decorator_force_failure = 'ForceFailure'
        self.node_decorator_force_success = 'ForceSuccess'
        self.node_decorator_inverter = 'Inverter'
        self.node_action_sleep = 'Sleep'
        self.next_node = 0
        self.nodes_path = []
        self.decorator_retry_depth = []

    def is_decorator_node(self, node_type):
        return ((node_type == self.node_decorator_retry_until_successful) or
                (node_type == self.node_decorator_repeat) or
                (node_type == self.node_decorator_keep_running_until_failure) or
                (node_type == self.node_decorator_force_failure) or 
                (node_type == self.node_decorator_force_success) or 
                (node_type == self.node_decorator_inverter) or
                (node_type == self.node_action_sleep))
    
    def is_decorator_retry_node(self, node_type):
        return ((node_type == self.node_decorator_retry_until_successful) or
                (node_type == self.node_decorator_repeat) or
                (node_type == self.node_decorator_keep_running_until_failure))

    def is_valid_node(self, node_type):
        return ((node_type == self.node_condition) or
                (node_type == self.node_action) or
                (node_type == self.node_delay) or
                (node_type == self.node_decorator_retry_until_successful) or
                (node_type == self.node_decorator_retry_until_successful) or
                (node_type == self.node_decorator_repeat) or
                (node_type == self.node_decorator_keep_running_until_failure) or
                (node_type == self.node_decorator_force_failure) or 
                (node_type == self.node_decorator_force_success) or 
                (node_type == self.node_decorator_inverter) or
                (node_type == self.node_action_sleep))

    def is_decorator_macro_node(self, node_type):
        return ((node_type == macro_node_retry_until_success) or (node_type == macro_node_reactive_retry_until_success) or
                (node_type == macro_node_repeat) or (node_type == macro_node_reactive_repeat) or
                (node_type == macro_node_keep_running_until_failure) or (node_type == macro_node_reactive_keep_running_until_failure) or
                (node_type == macro_node_force_failure) or (node_type == macro_node_reactive_force_failure) or
                (node_type == macro_node_force_success) or (node_type == macro_node_reactive_force_success) or
                (node_type == macro_node_inverter) or (node_type == macro_node_reactive_inverter) or
                (node_type == macro_node_sleep) or (node_type == macro_node_sleep))

    def is_decorator_macro_retry_node(self, node_type):
        return ((node_type == macro_node_retry_until_success) or (node_type == macro_node_reactive_retry_until_success) or
                (node_type == macro_node_repeat) or (node_type == macro_node_reactive_repeat) or
                (node_type == macro_node_keep_running_until_failure) or (node_type == macro_node_reactive_keep_running_until_failure))

    def get_nodes_name(self, node_root = None, node_fallback = None, node_reactive_fallback = None, 
                       node_sequence = None, node_reactive_sequence = None, 
                       node_action = None, node_condition = None, node_retry_until_successful = None, 
                       node_decorator_repeat = None, node_keep_running_until_failure = None, 
                       node_decorator_force_failure = None, node_decorator_force_success = None, 
                       node_decorator_inverter = None, node_action_sleep = None, 
                       node_delay = None, node_subtree = None):
        self.node_root = node_root
        self.node_fallback = node_fallback
        self.node_reactive_fallback = node_reactive_fallback
        self.node_sequence = node_sequence
        self.node_reactive_sequence = node_reactive_sequence
        self.node_action = node_action
        self.node_condition = node_condition
        self.node_retry_until_successful = node_retry_until_successful
        self.node_decorator_repeat = node_decorator_repeat
        self.node_keep_running_until_failure = node_keep_running_until_failure
        self.node_decorator_force_failure = node_decorator_force_failure
        self.node_decorator_force_success = node_decorator_force_success
        self.node_decorator_inverter = node_decorator_inverter
        self.node_action_sleep = node_action_sleep
        self.node_delay = node_delay
        self.node_subtree = node_subtree

    def process_node(self, node, node_status):
        if node[POSITION_NODE_TYPE] == self.node_root:
            if((self.tree_status == status_success) or (self.tree_status == status_fail)):
                return self.tree_status
            self.next_node = node[POSITION_NODE_SIBLING]
        elif ((node[POSITION_NODE_TYPE] == self.node_sequence) or (node[POSITION_NODE_TYPE] == self.node_fallback)):
            if self.tree_status == status_running:
                self.next_node = node[POSITION_NODE_CHILDREN]
                return status_running
            node_status = self.tree_status
        elif ((node[POSITION_NODE_TYPE] == self.node_reactive_sequence) or (node[POSITION_NODE_TYPE] == self.node_reactive_fallback)):
            if self.tree_status == status_running:
                self.next_node = node[POSITION_NODE_CHILDREN]
                return status_running
            node_status = self.tree_status
        if (((self.tree[node[POSITION_NODE_PARENT]][POSITION_NODE_TYPE] == self.node_fallback) and (node_status == status_success)) or 
            ((self.tree[node[POSITION_NODE_PARENT]][POSITION_NODE_TYPE] == self.node_sequence) and (node_status == status_fail)) or 
            ((self.tree[node[POSITION_NODE_PARENT]][POSITION_NODE_TYPE] == self.node_reactive_fallback) and (node_status == status_success)) or 
            ((self.tree[node[POSITION_NODE_PARENT]][POSITION_NODE_TYPE] == self.node_reactive_sequence) and (node_status == status_fail)) or 
            ((self.is_decorator_node(self.tree[node[POSITION_NODE_PARENT]][POSITION_NODE_TYPE]) and (node_status != status_running))) or
            ((node[POSITION_NODE_SIBLING] == NODE_UNRELATED))):
            self.next_node = node[POSITION_NODE_PARENT]
            self.tree_status = node_status
        elif ((self.is_decorator_node(self.tree[node[POSITION_NODE_PARENT]][POSITION_NODE_TYPE]) and (node_status == status_running))):
            self.next_node = node[POSITION_NODE_DECORATOR_TARGET]
            self.tree_status = node_status
            if self.is_decorator_retry_node(node[POSITION_NODE_TYPE]):
                put = True
                for i in self.decorator_retry_depth:
                    if i[0] == node[POSITION_NODE_INDEX]:
                        put = False 
                if put:
                    self.decorator_retry_depth.append([node[POSITION_NODE_INDEX], 0])
        else:
            self.tree_status = status_running
            self.next_node = node[POSITION_NODE_SIBLING]
        if((len(self.decorator_retry_depth) > 0)):
            for i in self.decorator_retry_depth:
                if i[0] == node[POSITION_NODE_INDEX]:
                    i[1] += 1
        return status_running        
        
    def is_flat_node(self, node_type):
        return ((node_type == self.node_condition) or
                (node_type == self.node_action) or
                (node_type == self.node_action_sleep) or
                self.is_decorator_node(node_type))

    def is_reactive_control(self, node_type):
        return ((node_type == self.node_reactive_sequence) or
                (node_type == self.node_reactive_fallback))

    def prepare_structure(self, tree):
        self.parent = {i: tree[i][POSITION_NODE_PARENT] for i in range(1, len(tree))}
        self.children = {i: [] for i in range(len(tree))}
        for i in range(1, len(tree)):
            self.children[self.parent[i]].append(i)
        self.flat = {}
        for i in range(len(tree)):
            if self.is_flat_node(tree[i][POSITION_NODE_TYPE]):
                self.flat[i] = len(self.flat)

        def first(i):
            while i not in self.flat:
                i = self.children[i][0]
            return self.flat[i]

        def last(i):
            while self.children[i]:
                i = self.children[i][-1]
            return self.flat[i]

        self.node_limit = {i: last(i) for i in self.flat}

        def reactive_start(i):
            parent = self.parent.get(i)
            if ((parent is not None) and self.is_reactive_control(tree[parent][POSITION_NODE_TYPE]) and
                    (self.children[parent][0] != i)):
                return first(parent)
            return None

        self.reactive_data = {}
        for i, flat in self.flat.items():
            data = (False, NODE_UNRELATED)
            node = i
            while node in self.parent:
                start = reactive_start(node)
                if start is not None:
                    entry = first(node)
                    data = (True, start) if entry == flat else (False, entry)
                    break
                node = self.parent[node]
            self.reactive_data[flat] = data

        def ancestors(i):
            path = []
            while i in self.parent:
                i = self.parent[i]
                path.append(i)
            return path

        counters = [i for i in range(len(tree))
                    if tree[i][POSITION_NODE_TYPE] in (self.node_decorator_retry_until_successful,
                                                       self.node_decorator_repeat)]
        self.attempts_slot = {}
        for i in counters:
            path_i = ancestors(i)
            used = set()
            for j in self.attempts_slot:
                path_j = ancestors(j)
                lca = next(a for a in [j] + path_j if a == i or a in path_i)
                if (lca in (i, j)) or self.is_reactive_control(tree[lca][POSITION_NODE_TYPE]):
                    used.add(self.attempts_slot[j])
            slot = 0
            while slot in used:
                slot += 1
            self.attempts_slot[i] = slot
        self.attempts_size = (max(self.attempts_slot.values()) + 1) if self.attempts_slot else 0

    def init_process(self, tree):
        self.tree = tree
        self.prepare_structure(tree)
        index = 0
        for i in range(len(tree)):
            if((tree[i][POSITION_NODE_TYPE] == self.node_condition) or
               (tree[i][POSITION_NODE_TYPE] == self.node_action) or
               (tree[i][POSITION_NODE_TYPE] == self.node_decorator_retry_until_successful) or
               (tree[i][POSITION_NODE_TYPE] == self.node_decorator_repeat) or
               (tree[i][POSITION_NODE_TYPE] == self.node_decorator_keep_running_until_failure) or
               (tree[i][POSITION_NODE_TYPE] == self.node_decorator_force_failure) or
               (tree[i][POSITION_NODE_TYPE] == self.node_decorator_force_success) or
               (tree[i][POSITION_NODE_TYPE] == self.node_decorator_inverter) or
               (tree[i][POSITION_NODE_TYPE] == self.node_action_sleep)):
                value = []
                for status in status_node:
                    status_tree = self.process_node(tree[i], status)
                    while((tree[self.next_node][POSITION_NODE_TYPE] != self.node_root) and
                          (tree[self.next_node][POSITION_NODE_TYPE] != self.node_condition) and
                          (tree[self.next_node][POSITION_NODE_TYPE] != self.node_action) and
                          (tree[self.next_node][POSITION_NODE_TYPE] != self.node_decorator_retry_until_successful) and
                          (tree[self.next_node][POSITION_NODE_TYPE] != self.node_decorator_repeat) and
                          (tree[self.next_node][POSITION_NODE_TYPE] != self.node_decorator_keep_running_until_failure) and
                          (tree[self.next_node][POSITION_NODE_TYPE] != self.node_decorator_force_failure) and 
                          (tree[self.next_node][POSITION_NODE_TYPE] != self.node_decorator_force_success) and 
                          (tree[self.next_node][POSITION_NODE_TYPE] != self.node_decorator_inverter) and 
                          (tree[self.next_node][POSITION_NODE_TYPE] != self.node_action_sleep) and 
                          (status_tree == status_running)):
                        self.process_node(tree[self.next_node], self.tree_status)
                    value.append(tree[self.next_node])
                    if (tree[self.next_node][POSITION_NODE_TYPE] == self.node_root):
                        value[-1] = NODE_UNRELATED
                if tree[i][POSITION_NODE_TYPE] == self.node_condition:
                    self.nodes_path.append([index, macro_node_condition, value[0], value[1],
                                            tree[i][POSITION_NODE_FUNCTION], tree[i]])
                elif tree[i][POSITION_NODE_TYPE] == self.node_action:
                    self.nodes_path.append([index, macro_node_action, value[0], value[1],
                                            tree[i][POSITION_NODE_FUNCTION], tree[i]])
                elif tree[i][POSITION_NODE_TYPE] == self.node_action_sleep:
                    self.nodes_path.append([index, macro_node_sleep, value[0], value[1],
                                            tree[i][POSITION_NODE_SLEEP], tree[i]])
                elif tree[i][POSITION_NODE_TYPE] == self.node_decorator_retry_until_successful:
                    self.nodes_path.append([index, macro_node_retry_until_success, value[0], value[1],
                                            tree[i][POSITION_NODE_DECORATOR_NUM_ATTEMPTS],
                                            self.attempts_slot[i], self.node_limit[i], tree[i]])
                elif tree[i][POSITION_NODE_TYPE] == self.node_decorator_repeat:
                    self.nodes_path.append([index, macro_node_repeat, value[0], value[1],
                                            tree[i][POSITION_NODE_DECORATOR_NUM_ATTEMPTS],
                                            self.attempts_slot[i], self.node_limit[i], tree[i]])
                elif tree[i][POSITION_NODE_TYPE] == self.node_decorator_keep_running_until_failure:
                    self.nodes_path.append([index, macro_node_keep_running_until_failure, value[0], value[1],
                                            self.node_limit[i], tree[i]])
                elif tree[i][POSITION_NODE_TYPE] == self.node_decorator_force_failure:
                    self.nodes_path.append([index, macro_node_force_failure, value[0], value[1], tree[i]])
                elif tree[i][POSITION_NODE_TYPE] == self.node_decorator_force_success:
                    self.nodes_path.append([index, macro_node_force_success, value[0], value[1], tree[i]])
                elif tree[i][POSITION_NODE_TYPE] == self.node_decorator_inverter:
                    self.nodes_path.append([index, macro_node_inverter, value[0], value[1], tree[i]])
                index += 1

        for i in range(len(self.nodes_path)):
            succes_case = False
            fail_case = False
            for j in range(len(self.nodes_path)):
                if((self.nodes_path[i][INDEX_SUCCESS_CASE] == self.nodes_path[j][INDEX_POINTER_VERIFY])):
                    self.nodes_path[i][INDEX_SUCCESS_CASE] = self.nodes_path[j][0]
                    succes_case = True
                if((self.nodes_path[i][INDEX_FAIL_CASE] == self.nodes_path[j][INDEX_POINTER_VERIFY])):
                    self.nodes_path[i][INDEX_FAIL_CASE] = self.nodes_path[j][0]
                    fail_case = True
                if((succes_case) and (fail_case)):
                    break

        for i in self.nodes_path:
            i.pop()
            is_reactive, reactive_index = self.reactive_data[i[INDEX_OF_POSITION]]
            if is_reactive:
                i[INDEX_OF_MACRO] = reactive_macro[i[INDEX_OF_MACRO]]
            i.insert(INDEX_REACTIVE, reactive_index)

        return self.nodes_path