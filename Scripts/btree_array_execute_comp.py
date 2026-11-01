import os
import xml.etree.ElementTree as ET
from btree_creator import ARCHIVE_CREATOR

NODE_UNRELATED = "BTREE_DEFINITION_TREE_UNRELATED"

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


class _Pending:
    __slots__ = ("value",)

    def __init__(self):
        self.value = None

    def resolve(self, value):
        self.value = value


class BTREE_ARRAY:
    def __init__(self):
        self.node_root = 'Root'
        self.node_sequence = 'Sequence'
        self.node_fallback = 'Fallback'
        self.node_reactive_sequence = 'ReactiveSequence'
        self.node_reactive_fallback = 'ReactiveFallback'
        self.node_action = 'Script'
        self.node_condition = 'ScriptCondition'
        self.node_retry_until_successful = 'RetryUntilSuccessful'
        self.node_decorator_repeat = 'Repeat'
        self.node_decorator_keep_running_until_failure = 'KeepRunningUntilFailure'
        self.node_decorator_force_failure = 'ForceFailure'
        self.node_decorator_force_success = 'ForceSuccess'
        self.node_decorator_inverter = 'Inverter'
        self.node_decorator_timeout = 'Timeout'
        self.node_delay = 'Sleep'
        self.node_subtree = 'SubTree'

        self.archive = ""
        self.main_tree = ""
        self.tree_archive = None

        self.archives = []
        self.functions = []
        self.texts = []
        self.nodes = []
        self.attempts_counter = 0
        self.tree_remodeled_size = 0

        self.library = ARCHIVE_CREATOR()

    def set_archive_data(self, name=None, email=None, version=None, copyrights=None, project=None):
        self.library.set_text(name=name, email=email, version=version, copyrights=copyrights, project=project)

    def set_nodes_name(self, node_root=None, node_fallback=None, node_reactive_fallback=None,
                       node_sequence=None, node_reactive_sequence=None,
                       node_action=None, node_condition=None, node_retry_until_successful=None,
                       node_decorator_repeat=None, node_keep_running_until_failure=None,
                       node_decorator_force_failure=None, node_decorator_force_success=None,
                       node_decorator_inverter=None, node_decorator_timeout=None,
                       node_delay=None, node_subtree=None):
        self.node_root = node_root
        self.node_fallback = node_fallback
        self.node_reactive_fallback = node_reactive_fallback
        self.node_sequence = node_sequence
        self.node_reactive_sequence = node_reactive_sequence
        self.node_action = node_action
        self.node_condition = node_condition
        self.node_retry_until_successful = node_retry_until_successful
        self.node_decorator_repeat = node_decorator_repeat
        self.node_decorator_keep_running_until_failure = node_keep_running_until_failure
        self.node_decorator_force_failure = node_decorator_force_failure
        self.node_decorator_force_success = node_decorator_force_success
        self.node_decorator_inverter = node_decorator_inverter
        self.node_decorator_timeout = node_decorator_timeout
        self.node_delay = node_delay
        self.node_subtree = node_subtree

    def is_decorator(self, tag):
        return tag in (
            self.node_retry_until_successful,
            self.node_decorator_repeat,
            self.node_decorator_keep_running_until_failure,
            self.node_decorator_force_failure,
            self.node_decorator_force_success,
            self.node_decorator_inverter,
            self.node_delay,
        )

    def compile(self, element, tree_id, on_success, on_fail, is_reactive):
        tag = element.tag

        if tag in (self.node_sequence, self.node_reactive_sequence):
            reactive = (tag == self.node_reactive_sequence)
            return self.compile_chain(list(element), tree_id, on_success, on_fail,
                                       reactive, propagate_via='fail')

        if tag in (self.node_fallback, self.node_reactive_fallback):
            reactive = (tag == self.node_reactive_fallback)
            return self.compile_chain(list(element), tree_id, on_success, on_fail,
                                       reactive, propagate_via='success')

        if tag == self.node_decorator_timeout:
            return self.compile(element[0], tree_id, on_success, on_fail, is_reactive)

        if tag == self.node_subtree:
            return self.compile_subtree(element, on_success, on_fail, is_reactive)

        if tag == self.node_condition or tag == self.node_action:
            return self.append_leaf(tag, element, tree_id, on_success, on_fail, is_reactive)

        if tag == self.node_delay:
            return self.append_sleep(element, on_success, on_fail, is_reactive)

        if self.is_decorator(tag):
            return self.append_decorator(tag, element, tree_id, on_success, on_fail, is_reactive)

        raise ValueError(f"Tipo de nó desconhecido no XML: {tag}")

    def compile_chain(self, children, tree_id, on_success, on_fail, is_reactive, propagate_via):
        n = len(children)
        first_entry = None
        pending = None

        for i, child in enumerate(children):
            is_last = (i == n - 1)
            if propagate_via == 'fail':
                cont_success = on_success if is_last else _Pending()
                cont_fail = on_fail
            else:
                cont_success = on_success
                cont_fail = on_fail if is_last else _Pending()

            entry = self.compile(child, tree_id, cont_success, cont_fail, is_reactive)

            if pending is not None:
                pending.resolve(entry)

            if first_entry is None:
                first_entry = entry

            pending = None if is_last else (cont_success if propagate_via == 'fail' else cont_fail)

        return first_entry

    def append_leaf(self, tag, element, tree_id, on_success, on_fail, is_reactive):
        idx = len(self.nodes)
        code = element.get('code')
        function = f"&btree_{self.library.project.lower()}{code}"
        if tag == self.node_condition:
            macro = macro_node_reactive_condition if is_reactive else macro_node_condition
            self.register_function(tree_id, code, "condition")
        else:
            macro = macro_node_reactive_action if is_reactive else macro_node_action
            self.register_function(tree_id, code, "action")
        self.nodes.append([idx, macro, on_success, on_fail, function])
        return idx

    def append_sleep(self, element, on_success, on_fail, is_reactive):
        idx = len(self.nodes)
        macro = macro_node_reactive_sleep if is_reactive else macro_node_sleep
        self.nodes.append([idx, macro, on_success, on_fail, element.get('msec')])
        return idx

    def append_decorator(self, tag, element, tree_id, on_success, on_fail, is_reactive):
        idx = len(self.nodes)
        self.nodes.append(None)
        self.compile(element[0], tree_id, idx, idx, is_reactive)
        node_limit = len(self.nodes) - 1

        if tag == self.node_retry_until_successful:
            macro = macro_node_reactive_retry_until_success if is_reactive else macro_node_retry_until_success
            attempts_index = self.attempts_counter
            self.attempts_counter += 1
            entry = [idx, macro, on_success, on_fail, element.get('num_attempts'), attempts_index, node_limit]

        elif tag == self.node_decorator_repeat:
            macro = macro_node_reactive_repeat if is_reactive else macro_node_repeat
            attempts_index = self.attempts_counter
            self.attempts_counter += 1
            entry = [idx, macro, on_success, on_fail, element.get('num_cycles'), attempts_index, node_limit]

        elif tag == self.node_decorator_keep_running_until_failure:
            macro = (macro_node_reactive_keep_running_until_failure if is_reactive
                     else macro_node_keep_running_until_failure)
            entry = [idx, macro, on_success, on_fail, node_limit]

        elif tag == self.node_decorator_force_failure:
            macro = macro_node_reactive_force_failure if is_reactive else macro_node_force_failure
            entry = [idx, macro, on_success, on_fail]

        elif tag == self.node_decorator_force_success:
            macro = macro_node_reactive_force_success if is_reactive else macro_node_force_success
            entry = [idx, macro, on_success, on_fail]

        elif tag == self.node_decorator_inverter:
            macro = macro_node_reactive_inverter if is_reactive else macro_node_inverter
            entry = [idx, macro, on_success, on_fail]

        else:
            raise ValueError(f"Decorador desconhecido: {tag}")

        self.nodes[idx] = entry
        return idx

    def compile_subtree(self, element, on_success, on_fail, is_reactive):
        ref_id = element.get('ID')
        root = self.tree_archive.getroot()
        for behavior_tree in root.findall('BehaviorTree'):
            if behavior_tree.get('ID') != ref_id:
                continue
            if ref_id not in self.archives:
                self.archives.append(ref_id)
                self.functions.append([])
            return self.compile_root_children(behavior_tree, ref_id, on_success, on_fail, is_reactive)
        raise ValueError(f"SubTree '{ref_id}' não encontrada no XML")

    def compile_root_children(self, behavior_tree, tree_id, on_success, on_fail, is_reactive):
        children = list(behavior_tree)
        if len(children) == 1:
            return self.compile(children[0], tree_id, on_success, on_fail, is_reactive)
        return self.compile_chain(children, tree_id, on_success, on_fail, is_reactive, propagate_via='fail')

    def register_function(self, tree_id, code, kind):
        already = any((code, kind) in functions_list for functions_list in self.functions)
        if not already:
            archive_idx = self.archives.index(tree_id)
            self.functions[archive_idx].append((code, kind))

    def resolve_pendencias(self):
        for node in self.nodes:
            for pos in (2, 3):
                if isinstance(node[pos], _Pending):
                    node[pos] = node[pos].value if node[pos].value is not None else NODE_UNRELATED

    def open_xml(self, archive):
        self.tree_archive = ET.parse(archive)
        root = self.tree_archive.getroot()
        for behavior_tree in root.findall('BehaviorTree'):
            tree_id = behavior_tree.get('ID')
            if tree_id != self.main_tree:
                continue

            self.archives = [self.main_tree]
            self.functions = [[]]
            self.nodes = []
            self.attempts_counter = 0

            self.compile_root_children(behavior_tree, tree_id, NODE_UNRELATED, NODE_UNRELATED, is_reactive=False)
            self.resolve_pendencias()

            text = self.library.tree_vector(tree_id, self.nodes)
            self.tree_remodeled_size = len(self.nodes)
            self.texts.append(text)
            return
        print(f"Árvore principal '{self.main_tree}' não encontrada em {archive}")

    def load_archive(self):
        if not self.archive.endswith('.xml'):
            print("Error to load archive")
            return
        self.open_xml(self.archive)

    def process_tree(self, archive, id, parent_tree, local_parent_tree):
        self.archive = archive
        self.main_tree = id
        self.load_archive()

    def create_trees(self, archive=None, output=None, main_tree=None):
        self.archive = archive if archive is not None else input("Put archive archive:")
        self.main_tree = main_tree if main_tree is not None else input("Put your main tree:")
        self.load_archive()
        self.library.generate_archives(self.archives, self.texts, self.functions,
                                        self.attempts_counter, self.tree_remodeled_size, output)