import os
import re
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
        self.attempts_value_max = 0
        self.attempts_size = 0

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
            name = f"{self.prefix.lower()}btree_{self.project.lower()}{archive.lower()}_{function[0]}"
            if name not in self.func_commented:
                self.func_commented.append(name)
                self.text += '/**\n'
                self.text += '* @brief \n'
                self.text += '*\n'
                self.text += '* @retval BTREE_DEFINITION_STATUS_SUCCESS case success;\n'
                self.text += '* @retval BTREE_DEFINITION_STATUS_FAIL case fail;\n'
                if function[1] == "action":
                    self.text += '* @retval BTREE_DEFINITION_STATUS_STAND_BY case waiting for something;\n'
                self.text += '*/\n'
                self.text += f"btree_definition_status_t {name}(void);\n\n"

    def create_declaration_empty(self, archive, functions):
        for function in functions:
            name = f"{self.prefix.lower()}btree_{self.project.lower()}{archive.lower()}_{function[0]}"
            if name not in self.func_empty:
                self.func_empty.append(name)
                self.text += f"btree_definition_status_t {name}(void)\n"
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

    @staticmethod
    def merge_editable(existing, generated, header):
        """Files you edit (leaf functions, blackboard) are never rewritten: the existing file is kept
        as it is and only the functions that are new in the tree are appended (declarations go
        before the closing #endif of a header)."""
        if header:
            pattern = r"(?ms)^/\*\*\n(?:(?!/\*\*).)*?\*/\nbtree_definition_status_t (\w+)\(void\);\n\n?"
        else:
            pattern = r"(?ms)^btree_definition_status_t (\w+)\(void\)\n\{.*?^\}\n\n?"
        missing = [m.group(0) for m in re.finditer(pattern, generated)
                   if not re.search(r"\b" + re.escape(m.group(1)) + r"\s*\(", existing)]
        if not missing:
            return existing
        addition = "".join(block if block.endswith("\n\n") else block + "\n" for block in missing)
        if header:
            guard = existing.rfind("#endif")
            if guard != -1:
                return existing[:guard] + addition + existing[guard:]
        if not existing.endswith("\n"):
            existing += "\n"
        if not existing.endswith("\n\n"):
            existing += "\n"
        return existing + addition.rstrip("\n") + "\n"

    def archive_end(self, archive, src = None, endif = None, editable = None):
        endif      = f"#endif /* {self.prefix.upper()}BTREE_{self.project.upper()}{archive.upper()}_H_ */" if src == None and endif == None else ""
        self.text += endif
        if editable == True:
            local = f'{self.output}/include/btree_{self.project[:-1].lower()}' if src == None else f'{self.output}/src/btree_{self.project[:-1].lower()}'
        else:
            local = f'{self.output}/tools/btree_{self.project[:-1].lower()}'
        archive_name = f"btree_{self.project.lower()}{archive}"
        archive_name += ".h" if src == None else ".c"
        os.makedirs(local, exist_ok=True) 
        output_bht = os.path.join(local, archive_name)
        final_text = self.text
        if editable == True and os.path.exists(output_bht):
            with open(output_bht, 'r', encoding='utf-8') as file:
                final_text = self.merge_editable(file.read(), self.text, header=(src == None))
        with open(output_bht, 'w', encoding='utf-8') as file:
            file.write(final_text)
        self.text = ""
    
    def tree_general_inc(self, tree_size):
        self.text         += "/**\n"
        self.text         += f" * @brief {self.project[:-1].lower()} tree size.\n"
        self.text         += " *\n */\n"
        self.text         += f"#define {self.prefix.upper()}BTREE_{self.project.upper()}ARRAY_SIZE {tree_size}\n\n"
        index_size = 8 if tree_size <= 0xFF else 16 if tree_size <= 0xFFFF else 32
        size_name  = f"{self.prefix.upper()}BTREE_{self.project.upper()}INDEX_SIZE"
        self.text         += "/**\n"
        self.text         += f" * @brief Smallest BTREE_DEFINITION_SIZE that holds the {self.project[:-1].lower()} tree.\n"
        self.text         += " * The library is built with a single BTREE_DEFINITION_SIZE: use the largest\n"
        self.text         += " * value among all the trees of the firmware.\n"
        self.text         += " *\n */\n"
        self.text         += f"#define {size_name} {index_size}\n\n"
        self.text         += f"#if BTREE_DEFINITION_SIZE < {size_name}\n"
        self.text         += f"#error \"The {self.project[:-1].lower()} tree has {tree_size} nodes: build with BTREE_DEFINITION_SIZE={index_size} or more.\"\n"
        self.text         += "#endif\n\n"
        value         = self.attempts_value_max
        attempts_size = 8 if value <= 0xFF else 16 if value <= 0xFFFF else 32
        attempts_name = f"{self.prefix.upper()}BTREE_{self.project.upper()}ATTEMPTS_SIZE"
        self.text         += "/**\n"
        self.text         += f" * @brief Smallest BTREE_DEFINITION_ATTEMPTS_SIZE that holds the counters of the {self.project[:-1].lower()} tree.\n"
        self.text         += " * The library is built with a single BTREE_DEFINITION_ATTEMPTS_SIZE: use the\n"
        self.text         += " * largest value among all the trees of the firmware.\n"
        self.text         += " *\n */\n"
        self.text         += f"#define {attempts_name} {attempts_size}\n\n"
        self.text         += f"#if BTREE_DEFINITION_ATTEMPTS_SIZE < {attempts_name}\n"
        self.text         += f"#error \"The {self.project[:-1].lower()} tree has a retry/repeat of {value}: build with BTREE_DEFINITION_ATTEMPTS_SIZE={attempts_size} or more.\"\n"
        self.text         += "#endif\n\n"
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
        self.text         += "#if BTREE_COMMON_DEBUG\n"
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
        self.text         += "    .tick_index      = BTREE_DEFINITION_TREE_UNRELATED,\n"
        if self.attempts_size > 0:
            self.text     += f"    .array_attempts  = {self.prefix.lower()}btree_{self.project.lower()}common_attempts,\n"
        else:
            self.text     += "    .array_attempts  = NULL,\n"
        self.text         += f"    .tree            = {self.prefix.lower()}btree_{self.project.lower()}array,\n"
        self.text         += f"#if BTREE_COMMON_DEBUG\n"
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

    def generate_common_inc(self, max_ramification_attempts):
        self.archive_header("common")
        self.archive_top("common")
        if max_ramification_attempts > 0:
            self.text += "/**\n"
            self.text += f" * @brief Number of counters used by the retry and repeat nodes of tree {self.project[:-1].lower()}.\n"
            self.text += " *\n */\n"
            self.text += f"#define {self.prefix.upper()}BTREE_{self.project.upper()}COMMON_ATTEMPTS_SIZE {max_ramification_attempts}\n\n"
            self.text += "/**\n"
            self.text += f" * @brief Externalize array of tree {self.project[:-1].lower()} attempts.\n"
            self.text += " *\n */\n"
            self.text += f"extern btree_definition_attempts_t {self.prefix.lower()}btree_{self.project.lower()}common_attempts[{self.prefix.upper()}BTREE_{self.project.upper()}COMMON_ATTEMPTS_SIZE];\n\n"
        self.archive_end("common")

    def generate_common_src(self, max_ramification_attempts):
        self.archive_header("common", src_file=True)
        self.archive_top("common", src_file=True)
        if max_ramification_attempts > 0:
            self.text += "/**\n"
            self.text += " * @brief Fields to input tries or attempts.\n"
            self.text += " *\n */\n"
            self.text += f"btree_definition_attempts_t {self.prefix.lower()}btree_{self.project.lower()}common_attempts[{self.prefix.upper()}BTREE_{self.project.upper()}COMMON_ATTEMPTS_SIZE] = {{0}};\n\n"
        self.archive_end("common", src=True)

    def generate_common(self, num_max_attempts):
        self.generate_common_inc(num_max_attempts)
        self.generate_common_src(num_max_attempts)

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
        self.attempts_size = attempts_max
        self.generate_common(attempts_max)
        self.generate_blackboard()
        self.generate_tree_array(archives, text, tree_size)