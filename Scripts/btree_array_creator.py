import os
import shutil
import bree_execute
import xml.etree.ElementTree as ET
from btree_creator import ARCHIVE_CREATOR

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
        self.is_node_root_main = False
        self.node_number = 0
        self.subtree_root_data = ["BTREE_DEFINITION_TREE_UNRELATED", "BTREE_DEFINITION_TREE_UNRELATED"]
        self.tree_id = 0
        self.tree_index = 0
        self.main_tree = ""
        self.tree_archive = None
        self.archives = []
        self.texts = []
        self.tree = []
        self.functions = []
        self.node_index_invalid = 'TC_BHT_DEFINITION_TREE_UNRELATED'
        self.attempts = 0
        self.attempts_max = 0
        self.attempts_value_max = 0
        self.attempts_blocks = 0
        self.tree_remodeled_size = 0
        self.archive = ""        
        self.library = ARCHIVE_CREATOR()

    def get_max_attempts(self):
        return self.max_attempts_nodes

    def set_archive_data(self, name = None, email = None, version = None, copyrights = None, project = None, prefix = None):
        self.library.set_text(name=name, email=email, version=version, copyrights=copyrights, project=project, prefix=prefix)

    def set_nodes_name(self, node_root = None, node_fallback = None, node_reactive_fallback = None, 
                       node_sequence = None, node_reactive_sequence = None, 
                       node_action = None, node_condition = None, node_retry_until_successful = None, 
                       node_decorator_repeat = None, node_keep_running_until_failure = None, 
                       node_decorator_force_failure = None, node_decorator_force_success = None, 
                       node_decorator_inverter = None, node_decorator_timeout = None, 
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
        self.node_decorator_timeout = node_decorator_timeout
        self.node_delay = node_delay
        self.node_subtree = node_subtree

    def set_sibling(self):
        for i in range(1, len(self.tree)):
            sibling_index = "BTREE_DEFINITION_TREE_UNRELATED"
            parent_index = self.tree[i][0]
            for j in range(len(self.tree) - 1, i, -1):
                if parent_index == self.tree[j][-2]:
                    self.tree[j][-3] = sibling_index
                    sibling_index = self.tree[j][0]

    def is_ignored_depth_node(self, node_type):
        return ((node_type == self.node_root) or 
                (node_type == self.node_subtree) or 
                (node_type == self.node_sequence) or 
                (node_type == self.node_fallback) or 
                (node_type == self.node_reactive_sequence) or 
                (node_type == self.node_reactive_fallback))

    def check_decorator_retry_depth(self, element):
        count = 0
        for child in element:
            if not self.is_ignored_depth_node(child.tag):
                count += 1 + self.check_decorator_retry_depth(child)
            else:
                count += self.check_decorator_retry_depth(child)
        return count

    def mount_nodes(self, element, node_parent_number, tree_id, is_reactive = False):
        self.node_number += 1
        is_decoration_attempts = False

        if self.node_fallback == element.tag:
            is_reactive = False
            self.tree.append([self.node_number, self.node_fallback, self.node_number + 1, 
                              "BTREE_DEFINITION_TREE_UNRELATED", node_parent_number, is_reactive])
            node_parent_number = self.node_number

        elif self.node_sequence == element.tag:
            is_reactive = False
            self.tree.append([self.node_number, self.node_sequence, self.node_number + 1, 
                              "BTREE_DEFINITION_TREE_UNRELATED", node_parent_number, is_reactive])
            node_parent_number = self.node_number

        elif self.node_reactive_fallback == element.tag:
            is_reactive = True
            self.tree.append([self.node_number, self.node_reactive_fallback, self.node_number + 1, 
                              "BTREE_DEFINITION_TREE_UNRELATED", node_parent_number, is_reactive])
            node_parent_number = self.node_number

        elif self.node_reactive_sequence == element.tag:
            is_reactive = True
            self.tree.append([self.node_number, self.node_reactive_sequence, self.node_number + 1, 
                              "BTREE_DEFINITION_TREE_UNRELATED", node_parent_number, is_reactive])
            node_parent_number = self.node_number

        elif self.node_action == element.tag:
            self.tree.append([self.node_number, self.node_action, 
                              f"&{self.library.prefix.lower()}btree_{self.library.project.lower()}{tree_id.lower()}_" + element.get('code'),
                              "BTREE_DEFINITION_TREE_UNRELATED", node_parent_number, is_reactive])
            node_parent_number -= 1
            if not element.get('code') in self.functions:
                self.functions[self.archives.index(tree_id)].append((element.get('code'), "action", tree_id))

        elif self.node_condition == element.tag:
            self.tree.append([self.node_number, self.node_condition, f"&{self.library.prefix.lower()}btree_{self.library.project.lower()}{tree_id.lower()}_" + element.get('code'), 
                              "BTREE_DEFINITION_TREE_UNRELATED", node_parent_number, is_reactive])
            node_parent_number -= 1
            if not element.get('code') in self.functions:
                self.functions[self.archives.index(tree_id)].append((element.get('code'), "condition", tree_id))

        elif self.node_retry_until_successful == element.tag:
            self.attempts_value_max = max(self.attempts_value_max, int(element.get('num_attempts')))
            self.tree.append([self.node_number, self.node_retry_until_successful, self.attempts_blocks, #attempts
                              element.get('num_attempts'), self.check_decorator_retry_depth(element), 
                              "BTREE_DEFINITION_TREE_UNRELATED", node_parent_number, is_reactive])
            node_parent_number = self.node_number
            self.attempts += 1
            self.attempts_blocks += 1
            is_decoration_attempts = True
            if self.attempts > self.attempts_max:
                self.attempts_max = self.attempts

        elif self.node_decorator_repeat == element.tag:
            self.attempts_value_max = max(self.attempts_value_max, int(element.get('num_cycles')))
            self.tree.append([self.node_number, self.node_decorator_repeat, self.attempts_blocks, #attempts
                              element.get('num_cycles'), self.check_decorator_retry_depth(element), 
                              "BTREE_DEFINITION_TREE_UNRELATED", node_parent_number, is_reactive])
            node_parent_number = self.node_number
            self.attempts += 1
            self.attempts_blocks += 1
            is_decoration_attempts = True
            if self.attempts > self.attempts_max:
                self.attempts_max = self.attempts

        elif self.node_decorator_keep_running_until_failure == element.tag:
            self.tree.append([self.node_number, self.node_decorator_keep_running_until_failure,
                              self.check_decorator_retry_depth(element), 
                              "BTREE_DEFINITION_TREE_UNRELATED", node_parent_number, is_reactive])
            node_parent_number = self.node_number

        elif self.node_decorator_force_failure == element.tag:
            self.tree.append([self.node_number, self.node_decorator_force_failure,
                              "BTREE_DEFINITION_TREE_UNRELATED", node_parent_number, is_reactive])
            node_parent_number = self.node_number

        elif self.node_decorator_force_success == element.tag:
            self.tree.append([self.node_number, self.node_decorator_force_success,
                              "BTREE_DEFINITION_TREE_UNRELATED", node_parent_number, is_reactive])
            node_parent_number = self.node_number

        elif self.node_decorator_inverter == element.tag:
            self.tree.append([self.node_number, self.node_decorator_inverter,
                              "BTREE_DEFINITION_TREE_UNRELATED", node_parent_number, is_reactive])
            node_parent_number = self.node_number

        elif self.node_decorator_timeout == element.tag:
            self.tree.append([self.node_number, self.node_decorator_timeout, element.get('msec'), 
                              "BTREE_DEFINITION_TREE_UNRELATED", node_parent_number, is_reactive])
            node_parent_number = self.node_number

        elif self.node_delay == element.tag:
            self.tree.append([self.node_number, self.node_delay, element.get('msec'), "BTREE_DEFINITION_TREE_UNRELATED",  
                              node_parent_number, is_reactive])
            node_parent_number = self.node_number

        elif self.node_subtree == element.tag:
            self.node_number -= 1
            root = self.tree_archive.getroot()
            for behavior_tree in root.findall('BehaviorTree'):
                tree_id_provisory = behavior_tree.get('ID')
                if tree_id_provisory == element.get('ID'):
                    self.archives.append(tree_id_provisory)
                    self.functions.append([])
                    self.mount_nodes(behavior_tree, node_parent_number, tree_id_provisory, is_reactive)
        
        elif self.is_node_root_main == False:
            self.node_number = 0
            self.is_node_root_main = True
            self.tree.append([self.node_number, self.node_root, self.subtree_root_data[0], 1, self.subtree_root_data[1]])

        else:
            self.node_number -= 1

        for child in element:
            self.mount_nodes(child, node_parent_number, tree_id, is_reactive)

        if is_decoration_attempts:
            self.attempts -= 1

    def open_xml(self, archive):
        self.tree_archive = ET.parse(archive)
        root = self.tree_archive.getroot()
        for behavior_tree in root.findall('BehaviorTree'):
            self.tree_id = behavior_tree.get('ID')
            if self.tree_id == self.main_tree:
                self.functions.clear()
                if self.tree_id in self.archives:
                    elements = [element for element in self.archives]
                    elements_count = len(elements)
                    self.tree_id += str(elements_count)
                    self.archives.append(self.tree_id)
                else:
                    self.archives.append(self.tree_id)
                self.functions.append([])
                self.mount_nodes(behavior_tree, 0, self.tree_id)
                self.set_sibling()
                x = bree_execute.BTREE_EXECUTE()
                tree_remodeled = x.init_process(self.tree)
                text = self.library.tree_vector(self.tree_id, tree_remodeled)
                self.tree_remodeled_size = len(tree_remodeled)
                self.attempts_blocks = x.attempts_size
                self.tree.clear()
                self.texts.append(text)

    def load_archive(self):
        if not self.archive.endswith('.xml'):
            print("Error to load archive")
            return
        self.open_xml(f"{self.archive}")

    def process_tree(self, archive, id, parent_tree, local_parent_tree):
        self.archive = archive
        self.main_tree = id
        self.subtree_root_data[0] = parent_tree
        self.subtree_root_data[1] = local_parent_tree
        self.load_archive()

    def create_trees(self, archive = None, output = None, main_tree = None):
        self.archive = archive if archive != None else input("Put archive archive:")
        self.main_tree = main_tree if main_tree != None else input("Put your main tree:")
        self.load_archive()
        self.library.attempts_value_max = self.attempts_value_max
        self.library.generate_archives(self.archives, self.texts, self.functions, self.attempts_blocks, self.tree_remodeled_size, output)
        # Keep the source tree next to the generated array: <output>/tools/btree_<project>/<archive>.xml
        tools = os.path.join(self.library.output, "tools", f"btree_{self.library.project[:-1].lower()}")
        os.makedirs(tools, exist_ok=True)
        if os.path.abspath(self.archive) != os.path.abspath(os.path.join(tools, os.path.basename(self.archive))):
            shutil.copy(self.archive, tools)
        self.max_attempts_nodes = 0