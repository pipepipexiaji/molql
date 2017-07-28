/*
 * Copyright (c) 2017 David Sehnal, licensed under MIT, See LICENSE file for more info.
 */

import CIF from 'ciftools.js'

export type Category<Columns extends string> = { readonly [name in Columns]: CIF.Column } & { rowCount: number }
export function Category<T extends object>(category: CIF.Category | undefined, columns: T): Category<keyof T> {
    const ret = Object.create(null);
    if (!category) for (const c of Object.keys(columns)) ret[c] = CIFTools.UndefinedColumn;
    else for (const c of Object.keys(columns)) ret[c] = category.getColumn(c);
    ret.rowCount = (category && category.rowCount) || 0;
    return ret;
}

export type AtomSite = keyof typeof AtomSite
export const AtomSite = {
    'group_PDB': '',
    'id': '',
    'type_symbol': '',
    'label_atom_id': '',
    'label_alt_id': '',
    'label_comp_id': '',
    'label_asym_id': '',
    'label_entity_id': '',
    'label_seq_id': '',
    'pdbx_PDB_ins_code': '',
    'pdbx_formal_charge': '',
    'Cartn_x': '',
    'Cartn_y': '',
    'Cartn_z': '',
    'occupancy': '',
    'B_iso_or_equiv': '',
    'auth_atom_id': '',
    'auth_comp_id': '',
    'auth_asym_id': '',
    'auth_seq_id': '',
    'pdbx_PDB_model_num': ''
}

export type Entity = keyof typeof Entity
export const Entity = {
    'id': '',
    'type': '',
    'src_method': '',
    'pdbx_description': '',
    'formula_weight': '',
    'pdbx_number_of_molecules': '',
    'details': '',
    'pdbx_mutation': '',
    'pdbx_fragment': '',
    'pdbx_ec': ''
}

export type StructConf = keyof typeof StructConf
export const StructConf = {
    'conf_type_id': '',
    'id': '',
    'pdbx_PDB_helix_id': '',
    'beg_label_comp_id': '',
    'beg_label_asym_id': '',
    'beg_label_seq_id': '',
    'pdbx_beg_PDB_ins_code': '',
    'end_label_comp_id': '',
    'end_label_asym_id': '',
    'end_label_seq_id': '',
    'pdbx_end_PDB_ins_code': '',
    'beg_auth_comp_id': '',
    'beg_auth_asym_id': '',
    'beg_auth_seq_id': '',
    'end_auth_comp_id': '',
    'end_auth_asym_id': '',
    'end_auth_seq_id': '',
    'pdbx_PDB_helix_class': '',
    'details': '',
    'pdbx_PDB_helix_length': ''
}

export type StructSheetRange = keyof typeof StructSheetRange
export const StructSheetRange = {
    'sheet_id': '',
    'id': '',
    'beg_label_comp_id': '',
    'beg_label_asym_id': '',
    'beg_label_seq_id': '',
    'pdbx_beg_PDB_ins_code': '',
    'end_label_comp_id': '',
    'end_label_asym_id': '',
    'end_label_seq_id': '',
    'pdbx_end_PDB_ins_code': '',
    'symmetry': '',
    'beg_auth_comp_id': '',
    'beg_auth_asym_id': '',
    'beg_auth_seq_id': '',
    'end_auth_comp_id': '',
    'end_auth_asym_id': '',
    'end_auth_seq_id': ''
}