"""Shared, idempotent grouping for the three reading/navigation components."""
COMPONENTS = {
    'MyoReadPos01': 'MyoReadBr01',
    'MyoBlockRef1': 'MyoBlockBr01',
    'MyoChapRail': 'MyoChapBr01',
}


def ensure_navigation_group(connection, local, utc):
    roots = connection.execute(
        "SELECT noteId FROM notes WHERE title='系统与插件' AND type IN ('text','render') AND isDeleted=0").fetchall()
    if not roots:
        roots = connection.execute(
            "SELECT noteId FROM notes WHERE title='Myosotis 程序组件' AND type IN ('text','render') AND isDeleted=0").fetchall()
    if len(roots) > 1:
        raise RuntimeError('Multiple program folders found; refusing to choose one')
    if roots:
        parent = roots[0][0]
    else:
        parent = 'MyoPluginRoot'
        create_folder(connection, parent, '系统与插件', 'root', 'MyoPluginRootBr', local, utc)
    groups = connection.execute(
        "SELECT DISTINCT n.noteId FROM notes n JOIN branches b ON n.noteId=b.noteId "
        "WHERE n.title='阅读与导航' AND n.isDeleted=0 AND b.isDeleted=0 AND b.parentNoteId=?", (parent,)).fetchall()
    if len(groups) > 1:
        raise RuntimeError('Multiple navigation folders found')
    if groups:
        return groups[0][0]
    group = 'MyoReadNav01'
    create_folder(connection, group, '阅读与导航', parent, 'MyoReadNavBr', local, utc)
    return group


def create_folder(connection, note_id, title, parent, branch_id, local, utc):
    if connection.execute('SELECT 1 FROM notes WHERE noteId=?', (note_id,)).fetchone():
        raise RuntimeError('Folder ID already used; refusing to overwrite')
    blob_id = note_id + 'Blob'
    if connection.execute('SELECT 1 FROM blobs WHERE blobId=?', (blob_id,)).fetchone():
        raise RuntimeError('Folder blob ID already used')
    connection.execute('INSERT INTO blobs(blobId,content,dateModified,utcDateModified,textRepresentation) VALUES(?,?,?,?,?)',
                       (blob_id, '', local, utc, ''))
    connection.execute(
        "INSERT INTO notes(noteId,title,type,mime,isProtected,blobId,isDeleted,dateCreated,dateModified,utcDateCreated,utcDateModified) "
        "VALUES(?,?,'text','text/html',0,?,0,?,?,?,?)", (note_id, title, blob_id, local, local, utc, utc))
    connection.execute(
        "INSERT INTO branches(branchId,noteId,parentNoteId,notePosition,isExpanded,isDeleted,utcDateModified) VALUES(?,?,?,900,0,0,?)",
        (branch_id, note_id, parent, utc))
    connection.execute(
        "INSERT INTO attributes(attributeId,noteId,type,name,value,position,isDeleted,isInheritable,utcDateModified) "
        "VALUES(?,?,'label','iconClass','bx bx-folder',10,0,0,?)", (note_id + 'Icon', note_id, utc))


def group_components(connection, group, utc):
    moved = 0
    for note_id, branch_id in COMPONENTS.items():
        # Move only installer-owned branches; preserve all user-created clones.
        moved += connection.execute(
            'UPDATE branches SET parentNoteId=?,utcDateModified=? WHERE branchId=? AND noteId=? AND isDeleted=0 AND parentNoteId<>?',
            (group, utc, branch_id, note_id, group)).rowcount
    return moved
