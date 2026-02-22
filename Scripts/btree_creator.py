import os
import re
import math
import difflib
from datetime import date

NODE_UNRELATED = "BTREE_DEFINITION_TREE_UNRELATED"

class ARCHIVE_CREATOR:
    def __init__(self):
        self.text = ""
        self.name = ""
        self.email = ""
        self.version = ""
        self.copyrights = ""
        self.project = ""
        self.output = ""
        self.prefix = ""
        self.func_commented = []
        self.func_empty = []

    def set_text(self, name = None, email = None, version = None, copyrights = None, project = None, prefix = None):
        self.name = name if name != None else input("Put your name:")
        self.email = email if email != None else input("Put your email:")
        self.version = version if version != None else input("Put your project version:")
        self.copyrights = copyrights if copyrights != None else input("Put your copyrights:")
        self.project = project if project != None else input("Put your project ID:")
        if self.project != "":
            self.project = self.project + "_"
        if(prefix != None):
            self.prefix = prefix + "_"

    def archive_header(self, archive, src_file = None):
        today          = date.today()
        self.text      = "/**\n"
        self.text     += f" * @file btree_{self.project.lower()}{(archive.lower())}." 
        self.text     += "h\n" if src_file == None else "c\n"
        if ((self.name != "") and (self.email != "")):
            self.text += f" * @author {self.name} " if self.name != "" else ""
            self.text += f"({self.email.lower()})" if self.email != "" else ""
            self.text += "\n"
        self.text     += f" * @brief Header of interface " if src_file == None else " * @brief Interface "
        self.text     += f"of the common variables of the {self.project.lower()[:-1]}.\n" if archive == "common" else f"of {archive.lower()} tree.\n"
        self.text     += f" * @version {self.version}\n" if (self.version != "") else ""
        self.text     += f' * @date {today.strftime("%d/%m/%Y")}\n'
        self.text     += f" *\n * @copyright Copyright © {today.year} {self.copyrights}. All rights reserved.\n" if self.copyrights != "" else ""
        self.text     += " *\n */\n\n"

    def archive_top(self, archive, src_file = False, includes = None):
        if src_file == False:
            self.text    += f"#ifndef {self.prefix.upper()}BTREE_{self.project.upper()}{archive.upper()}_H_\n"
            self.text    += f"#define {self.prefix.upper()}BTREE_{self.project.upper()}{archive.upper()}_H_\n\n"
            if archive == 'common':
                self.text    += f'#include "btree_definition.h"\n'
            else:
                self.text    += f'#include "btree_{self.project.lower()}blackboard.h"\n'
        else:
            self.text    += f"#include \"btree_{self.project.lower()}{archive.lower()}.h\"\n"
        if includes != None:
            for i in includes:
                self.text    += f"#include \"btree_{self.project.lower()}{i.lower()}.h\"\n"
        self.text += "\n"
            
    def tree_vector(self, archive, btree_array):
        array_texts = []
        for item in btree_array:
            index          = item[0]
            node_type      = item[1]
            if isinstance(item[2], str) and item[2] != NODE_UNRELATED:
                item[2]    =  f"&{self.project.lower()}" + item[2]
            params         = ', '.join(map(str, item[2:]))
            array_texts.append(f"        [{index}] = {node_type}({params}), \n")
        return array_texts

    def create_declaration_commented(self, archive, functions):
        for function in functions:
            if function[0] not in self.func_commented:
                self.func_commented.append(function[0])
                self.text += '/**\n'
                self.text += '* @brief \n'
                self.text += '*\n'
                self.text += '* @retval BTREE_DEFINITION_STATUS_SUCCESS case success;\n'
                self.text += '* @retval BTREE_DEFINITION_STATUS_FAIL case fail;\n'
                if function[1] == "action":
                    self.text += '* @retval BTREE_DEFINITION_STATUS_STAND_BY case waiting for something;\n'
                self.text += '*/\n'
                self.text += f"btree_definition_status_t {self.prefix}btree_{self.project.lower()}{function[0]}(void);\n\n"

    def create_declaration_empty(self, archive, functions):
        for function in functions:
            if function[0] not in self.func_empty:
                self.func_empty.append(function[0])
                self.text += f"btree_definition_status_t {self.prefix}btree_{self.project.lower()}{function[0]}(void)\n"
                self.text += "{\n"
                self.text += "  return BTREE_DEFINITION_STATUS_SUCCESS;\n}\n\n"

    def create_inc(self, archive, functions):
        self.archive_header(archive)
        self.archive_top(archive)
        if functions != None:
            self.create_declaration_commented(archive, functions)
        self.archive_end(archive, editable=True)

    def create_src(self, archive, functions):
        self.archive_header(archive, src_file=True)
        self.archive_top(archive, src_file=True)
        if functions != None:
            self.create_declaration_empty(archive, functions)
        self.archive_end(archive, src=True, editable=True)

    def archive_end(self, archive, src = None, endif = None, editable = None):
        endif      = f"#endif /* {self.prefix.upper()}BTREE_{self.project.upper()}{archive.upper()}_H_ */" if src == None and endif == None else ""
        self.text += endif
        if editable == True:
            local = f'{self.output}/include/btree_{self.project[:-1].lower()}' if src == None else f'{self.output}/src/btree_{self.project[:-1].lower()}'
        else:
            local = f'{self.output}/btrees/btree_{self.project[:-1].lower()}'
        archive_name = f"btree_{self.project.lower()}{archive}"
        archive_name += ".h" if src == None else ".c"
        os.makedirs(local, exist_ok=True) 
        output_bht = os.path.join(local, archive_name)
        final_text = self.text
        if editable == True and os.path.exists(output_bht):
            with open(output_bht, 'r', encoding='utf-8') as file:
                texto_existente = file.read()
            diff = difflib.ndiff(
                texto_existente.splitlines(keepends=True), 
                self.text.splitlines(keepends=True)
            )
            linhas_merged = []
            for linha in diff:
                if linha.startswith('  '):
                    linhas_merged.append(linha[2:])
                elif linha.startswith('- '):
                    linhas_merged.append(linha[2:])
                elif linha.startswith('+ '):
                    linhas_merged.append(linha[2:])
            final_text = "".join(linhas_merged)
        with open(output_bht, 'w', encoding='utf-8') as file:
            file.write(final_text)
        self.text = ""
    
    def tree_general_inc(self, tree_size):
        self.text         += "/**\n"
        self.text         += f" * @brief {self.project[:-1].lower()} tree size.\n"
        self.text         += " *\n */\n"
        self.text         += f"#define {self.prefix.upper()}BTREE_{self.project.upper()}ARRAY_SIZE {tree_size}\n\n"
        self.text         += "/**\n"
        self.text         += f" * @brief Array containing the nodes of the {self.project[:-1].lower()} tree.\n"
        self.text         += " *\n */\n"
        self.text         += f"extern const btree_definition_node_t {self.prefix.lower()}btree_{self.project.lower()}array[{self.prefix.upper()}BTREE_{self.project.upper()}ARRAY_SIZE];\n\n"
        self.text         += "/**\n"
        self.text         += f" * @brief Externalizes {self.project[:-1].lower()} tree control structure.\n"
        self.text         += " *\n */\n"
        self.text         += f"extern btree_definition_tree_data_t {self.prefix.lower()}btree_{self.project.lower()}control;\n\n"

    def tree_general_src(self, btree_array):
        self.text         += "/**\n"
        self.text         += f" * @brief Array containing the nodes of the {self.project[:-1].lower()} tree.\n"
        self.text         += " *\n */\n"
        self.text         += f"const btree_definition_node_t {self.prefix.lower()}btree_{self.project.lower()}array[{self.prefix.upper()}BTREE_{self.project.upper()}ARRAY_SIZE] = \n"
        self.text         += "{\n"
        for item in btree_array:
            for i in item:
                self.text     += i
        self.text         += "};\n\n"
        self.text         += "#if BTREE_COMMON_DEBUG == 1\n"
        self.text         += "/**\n"
        self.text         += f" * @brief Array containing the debug string names of the nodes of {self.project[:-1].lower()} tree.\n"
        self.text         += " *\n */\n"
        self.text         += f"static const char * const {self.prefix.lower()}btree_{self.project.lower()}array_debug[{self.prefix.upper()}BTREE_{self.project.upper()}ARRAY_SIZE] = \n"
        self.text         += "{\n"
        for item in btree_array:
            for i in item:
                name           = re.search(r"&([a-zA-Z0-9_]+)\)", i)
                self.text     += "        "
                if name:
                    self.text += f"\"{name.group(1)}\""
                else:
                    self.text += "NULL"
                self.text     += ",\n"
            self.text         += "};\n\n"
            self.text         += "/**\n"
            self.text         += f" * @brief Struct of debug information of the {self.project[:-1].lower()} tree.\n"
            self.text         += " *\n */\n"
            self.text         += f"static const btree_definition_debug_t btree_{self.project.lower()}debug_item = {{\n"
            self.text         += f"    .tree_name = \"{self.project.upper()[:-1]}\",\n"
            self.text         += f"    .functions_name = {self.prefix.lower()}btree_{self.project.lower()}array_debug,\n"
            self.text         += "};\n"
        self.text         += "#endif\n\n"
        self.text         += "/**\n"
        self.text         += f" * @brief {self.project[:-1].lower()} tree Control Structure.\n"
        self.text         += " *\n */\n"
        self.text         += f"btree_definition_tree_data_t {self.prefix.lower()}btree_{self.project.lower()}control = "
        self.text         += "{\n"
        self.text         += "    .last_node_state = BTREE_DEFINITION_STATUS_RUNNING,\n"
        self.text         += "    .node_index      = BTREE_DEFINITION_NODE_FIRST_INDEX,\n"
        self.text         += f"    .tree_size       = {self.prefix.upper()}BTREE_{self.project.upper()}ARRAY_SIZE,\n"
        self.text         += f"    .nodes_status    = {self.prefix.lower()}btree_{self.project.lower()}status_nodes,\n"
        self.text         += f"    .array_attempts  = {self.prefix.lower()}btree_{self.project.lower()}common_attempts,\n"
        self.text         += f"    .tree            = {self.prefix.lower()}btree_{self.project.lower()}array,\n"
        self.text         += f"#if BTREE_COMMON_DEBUG == 1\n"
        self.text         += f"    .debug           = &btree_{self.project.lower()}debug_item,\n"
        self.text         += "#else\n"
        self.text         += f"    .debug           = NULL,\n"
        self.text         += "#endif\n"
        self.text         += "};\n\n"

    def generate_general_tree_inc(self, tree_size):
        archive_sufix = "array"
        self.archive_header(archive_sufix)
        self.archive_top(archive_sufix)
        self.tree_general_inc(tree_size)
        self.archive_end(archive_sufix)
        
    def generate_general_tree_src(self, archives, btree_array):
        archive_sufix = "array"
        self.archive_header(archive_sufix, src_file = True)
        self.archive_top(archive_sufix, src_file = True, includes = archives)
        self.tree_general_src(btree_array)
        self.archive_end(archive_sufix, src = True)

    def generate_blackboard_inc(self):
        self.text  = "/**\n"
        self.text += f" * @file btree_{self.project.lower()}blackboard.h\n"
        if ((self.name != "") and (self.email != "")):
            self.text += f" * @author {self.name} " if self.name != "" else ""
            self.text += f"({self.email.lower()})\n" if self.email != "" else ""
        self.text += " * @brief Blackboard interface header.\n"
        self.text += f" * @version {self.version}\n" if (self.version != "") else ""
        self.text += f" * @date {date.today().strftime('%d/%m/%Y')}\n"
        self.text += " *\n"
        self.text += f" * @copyright Copyright © {date.today().year} {self.copyrights}. All rights reserved.\n" if self.copyrights != "" else ""
        self.text += " *\n"
        self.text += " */\n\n"
        self.text += f"#ifndef {self.prefix.upper()}BTREE_{self.project.upper()}BLACKBOARD_H_\n"
        self.text += f"#define {self.prefix.upper()}BTREE_{self.project.upper()}BLACKBOARD_H_\n\n"
        self.text += f"#include \"btree_{self.project.lower()}common.h\"\n\n"
        self.text += "/**\n"
        self.text += f" * @brief Blackboard {self.project[:-1].lower()} tree struct.\n"
        self.text += " * \n"
        self.text += " */\n"
        self.text += f"struct {self.prefix.lower()}btree_{self.project[:-1].lower()}_blackboard {{\n"
        self.text += "};\n\n"
        self.text += "/**\n"
        self.text += f" * @brief Structure with relevant data from the {self.project[:-1].lower()} tree blackboard.\n"
        self.text += " * \n"
        self.text += " */\n"
        self.text += f"extern struct {self.prefix.lower()}btree_{self.project.lower()}blackboard {self.prefix.lower()}btree_{self.project.lower()}data;\n\n"
        self.text += "/**\n"
        self.text += f" * @brief Clear all blackboard data from the {self.project[:-1].lower()} tree.\n"
        self.text += " * \n"
        self.text += " */\n"
        self.text += f"void {self.prefix.lower()}btree_{self.project.lower()}reset_blackboard(void);\n\n"
        self.text += f"#endif /* {self.prefix.upper()}BTREE_{self.project.upper()}BLACKBOARD_H_ */\n"

    def generate_blackboard_src(self):
        self.text  = "/**\n"
        self.text += f" * @file btree_{self.project.lower()}blackboard.c\n"
        if ((self.name != "") and (self.email != "")):
            self.text += f" * @author {self.name} " if self.name != "" else ""
            self.text += f"({self.email.lower()})\n" if self.email != "" else ""
        self.text += " * @brief Blackboard interface.\n"
        self.text += f" * @version {self.version}\n" if (self.version != "") else ""
        self.text += f" * @date {date.today().strftime('%d/%m/%Y')}\n"
        self.text += " *\n"
        self.text += f" * @copyright Copyright © {date.today().year} {self.copyrights}. All rights reserved.\n" if self.copyrights != "" else ""
        self.text += " *\n"
        self.text += " */\n"
        self.text += "\n" 
        self.text += f"#include \"string.h\"\n"
        self.text += f"#include \"btree_{self.project.lower()}blackboard.h\"\n\n"
        self.text += "/**\n"
        self.text += f" * @brief Tree structure with relevant blackboard data {self.project[:-1].lower()}.\n"
        self.text += " * \n"
        self.text += " */\n"
        self.text += f"struct {self.prefix.lower()}btree_{self.project[:-1].lower()}_blackboard {self.prefix.lower()}btree_{self.project[:-1].lower()}_data = {{\n"
        self.text += "};\n\n"
        self.text += f"void {self.prefix.lower()}btree_{self.project.lower()}reset_blackboard(void)\n"
        self.text += "{\n"
        self.text += f"    memset(&{self.prefix.lower()}btree_{self.project.lower()}data, 0, sizeof({self.prefix.lower()}btree_{self.project.lower()}data));\n"
        self.text += "}\n"

    def generate_blackboard(self):
        self.generate_blackboard_inc()
        self.archive_end('blackboard', endif = False, editable=True)
        self.generate_blackboard_src()
        self.archive_end('blackboard', src=True, endif = False, editable=True)
        #output_src = os.path.join(f'{self.output}/src/btree_{self.project[:-1].lower()}', f'btree_{self.project.lower()}blackboard.c')
        #os.makedirs(os.path.dirname(output_src), exist_ok=True)
        #with open(output_src, 'w', encoding='utf-8') as file:
        #    file.write(self.text)
        #self.text = ""

    def generate_common_inc(self, max_ramification_attempts, tree_size):
        self.archive_header("common")
        self.archive_top("common")
        self.text += "/**\n"
        self.text += " * @brief Size of array nodes status.\n"
        self.text += " *\n */\n"
        self.text += f"#define {self.prefix.upper()}BTREE_{self.project.upper()}COMMON_STATUS_NODES_SIZE (btree_index_t) {math.ceil((tree_size / 16))}\n\n"
        self.text += "/**\n"
        self.text += f" * @brief Number of fields needed in the worst case scenario of tree {self.project[:-1].lower()} attempted fields.\n"
        self.text += " *\n */\n"
        self.text += f"#define {self.prefix.upper()}BTREE_{self.project.upper()}COMMON_ATTEMPTS_SIZE {max_ramification_attempts}\n\n"
        self.text += "/**\n"
        self.text += f" * @brief Externalize array of tree {self.project[:-1].lower()} attemps.\n"
        self.text += " *\n */\n"
        self.text += f"extern uint32_t {self.prefix.lower()}btree_{self.project.lower()}status_nodes[{self.prefix.upper()}BTREE_{self.project.upper()}COMMON_STATUS_NODES_SIZE];\n\n"
        self.text += "/**\n"
        self.text += f" * @brief Externalize array of tree {self.project[:-1].lower()} attemps.\n"
        self.text += " *\n */\n"
        self.text += f"extern uint32_t {self.prefix.lower()}btree_{self.project.lower()}common_attempts[{self.prefix.upper()}BTREE_{self.project.upper()}COMMON_ATTEMPTS_SIZE];\n\n"
        self.archive_end("common")

    def generate_common_src(self):
        self.archive_header("common", src_file=True)
        self.archive_top("common", src_file=True)
        self.text += "/**\n"
        self.text += " * @brief Nodes states. Each value, carry 16 nodes status. Each node status is 2 bits.\n"
        self.text += " *\n */\n"
        self.text += f"uint32_t {self.prefix.lower()}btree_{self.project.lower()}status_nodes[{self.prefix.upper()}BTREE_{self.project.upper()}COMMON_STATUS_NODES_SIZE] = {{0}};\n\n"
        self.text += "/**\n"
        self.text += " * @brief Fields to input tries or attempts.\n"
        self.text += " *\n */\n"
        self.text += f"uint32_t {self.prefix.lower()}btree_{self.project.lower()}common_attempts[{self.prefix.upper()}BTREE_{self.project.upper()}COMMON_ATTEMPTS_SIZE] = {{0}};\n\n"
        self.archive_end("common", src=True)

    def generate_common(self, num_max_attempts, tree_size):
        self.generate_common_inc(num_max_attempts, tree_size)
        self.generate_common_src()

    def generate_archive_tree(self, archive, functions):
        self.create_inc(archive, functions)
        self.create_src(archive, functions)

    def generate_tree_array(self, archives, text, tree_size):
        self.generate_general_tree_inc(tree_size)
        self.generate_general_tree_src(archives, text)

    def generate_archives(self, archives, text, functions, attempts_max, tree_size, output = None):
        if output == None:
            self.output = "Output"
        else:
            self.output = output
        for i in range(len(functions)):
            self.generate_archive_tree(archives[i], functions[i])
        self.generate_common(attempts_max, tree_size)
        self.generate_blackboard()
        self.generate_tree_array(archives, text, tree_size)