from btree_array_creator import BTREE_ARRAY

# Example to generated tree arrays and items.
archive = 'tree-examples/simple.xml'
output = 'Output'
name = "Renilson Almeida"
email = "joserenilson.silva@edge.ufal.br"
version = "1.0"
copyrights = ""
tree_name = "main"
main_tree = 'subtree'

x = BTREE_ARRAY()
x.set_archive_data(name, email, version, copyrights, tree_name)
x.create_trees(archive = archive, output = output, main_tree = main_tree)