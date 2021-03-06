/*
 * Copyright (c) 2017 MolQL contributors, licensed under MIT, See LICENSE file for more info.
 *
 * @author David Sehnal <david.sehnal@gmail.com>
 */

import CIF from 'ciftools.js'
import * as mmCIF from './mmcif'
import { Structure, Model, SecondaryStructureType } from './data'
import { FastMap } from '../utils/collections'
import { SecondaryStructureFlag, SecondaryStructureMmcif, SecondaryStructurePdb } from './topology/secondary-structure'

type Data = Model['data']

function createModel(structureId: string, data: Data, startRow: number, rowCount: number): Model {
    const dataIndex: number[] = [], residueIndex: number[] = [];
    const atomOffset: number[] = [0], chainIndex: number[] = [];
    const x: number[] = [], y: number[] = [], z: number[] = [];
    const residueOffset: number[] = [0], entityIndex: number[] = [];
    const chainOffset: number[] = [0];

    const { auth_asym_id, auth_seq_id, pdbx_PDB_ins_code, pdbx_PDB_model_num, label_entity_id, Cartn_x, Cartn_y, Cartn_z } = data.atom_site;

    let atom = 0, residue = 0, chain = 0, entity = 0;
    let residueStartAtom = 0;
    let chainStartResidue = 0;
    let entityStartChain = 0;

    let currentResidueRow = startRow, currentChainRow = startRow, currentEntityRow = startRow;

    for (let i = startRow; i < rowCount; i++) {

        if (!pdbx_PDB_model_num.areValuesEqual(startRow, i)) break;

        let newEntity = !label_entity_id.areValuesEqual(currentEntityRow, i);
        let newChain = newEntity || !auth_asym_id.areValuesEqual(currentChainRow, i);
        let newResidue = newChain
            || !auth_seq_id.areValuesEqual(currentResidueRow, i)
            || !pdbx_PDB_ins_code.areValuesEqual(currentResidueRow, i);

        if (newResidue) {
            atomOffset.push(atom)
            chainIndex.push(chain)
            residueStartAtom = atom;
            residue++;
            currentResidueRow = i;
        }

        if (newChain) {
            residueOffset.push(residue);
            entityIndex.push(entity);
            currentChainRow = i;
            chainStartResidue = residue;
            chain++;
        }

        if (newEntity) {
            chainOffset.push(chain);
            currentEntityRow = i;
            entityStartChain = chain;
            entity++;
        }

        dataIndex.push(i);
        x.push(Cartn_x.getFloat(i));
        y.push(Cartn_y.getFloat(i));
        z.push(Cartn_z.getFloat(i));
        residueIndex.push(residue);

        atom++;
    }


    // finish residue
    atomOffset.push(atom);
    chainIndex.push(chain);

    // finish chain
    residueOffset.push(residue + 1);
    entityIndex.push(entity);

    // finish entity
    chainOffset.push(chain + 1);

    residue++;
    chain++;
    entity++;

    return {
        structureId,
        id: pdbx_PDB_model_num.getInteger(startRow),
        atoms: { dataIndex, residueIndex, count: atom },
        residues: { atomOffset, chainIndex, count: residue, key: new Int32Array(residue) as any },
        chains: { residueOffset, entityIndex, count: chain, key: new Int32Array(chain) as any },
        entities: { chainOffset, count: entity, key: new Int32Array(entity) as any, dataIndex: new Int32Array(entity) as any },
        secondaryStructure: {
            type: new Uint8Array(residue) as any,
            index: new Int32Array(residue) as any,
            flags: new Uint32Array(residue) as any,
            key: new Int32Array(residue) as any
        },
        modifiedResidues: FastMap.create(),
        positions: { x, y, z },
        data,
        '@spatialLookup': void 0,
        '@connectedComponentKey': void 0,
        '@bonds': void 0,
        '@rings': void 0
    };
}

function getElementKey(map: FastMap<string | number, number>, key: string | number, counter: { index: number }) {
    if (map.has(key)) return map.get(key)!;
    const ret = counter.index++;
    map.set(key, ret);
    return ret;
}

function getElementSubstructureKeyMap(map: FastMap<number, FastMap<string, number>>, key: number) {
    if (map.has(key)) return map.get(key)!;
    const ret = FastMap.create<string, number>();
    map.set(key, ret);
    return ret;
}

function assignKeysAndDataIndices(model: Model) {
    // TODO: expose maps to allow fast key lookup!

    const entityDataIndexMap = FastMap.create<string, number>();
    const entity = model.data.entity;
    for (let i = 0; i < entity.rowCount; i++) entityDataIndexMap.set(entity.id.getString(i) || '', i);

    const entityMap = FastMap.create<string, number>(), entityCounter = { index: 0 };
    const chainMaps = FastMap.create<number, FastMap<string, number>>(), chainCounter = { index: 0 };
    const residueMaps = FastMap.create<number, FastMap<string, number>>(), residueCounter = { index: 0 };

    const { dataIndex } = model.atoms;
    const { key: residueKey, atomOffset } = model.residues;
    const { key: chainKey, residueOffset } = model.chains;
    const { key: entityKey, count: entityCount, chainOffset, dataIndex: entityDataIndex } = model.entities;

    const { label_entity_id, auth_asym_id, auth_seq_id, pdbx_PDB_ins_code } = model.data.atom_site;

    for (let eI = 0; eI < entityCount; eI++) {
        const chainStart = chainOffset[eI], chainEnd = chainOffset[eI + 1];
        let dataRow = dataIndex[atomOffset[residueOffset[chainStart]]];

        const entId = label_entity_id.getString(dataRow)!;
        entityDataIndex[eI] = entityDataIndexMap.get(entId) || 0;

        const eKey = getElementKey(entityMap, entId, entityCounter);
        entityKey[eI] = eKey;
        const chainMap = getElementSubstructureKeyMap(chainMaps, eKey);
        for (let cI = chainStart; cI < chainEnd; cI++) {
            const residueStart = residueOffset[cI], residueEnd = residueOffset[cI + 1];
            dataRow = dataIndex[atomOffset[residueStart]];

            const cKey = getElementKey(chainMap, auth_asym_id.getString(dataRow)!, chainCounter);
            chainKey[cI] = cKey;
            const residueMap = getElementSubstructureKeyMap(residueMaps, cKey);
            for (let rI = residueStart; rI < residueEnd; rI++) {
                dataRow = dataIndex[atomOffset[rI]];
                residueKey[rI] = getElementKey(residueMap, pdbx_PDB_ins_code.getValuePresence(dataRow) !== CIF.ValuePresence.Present
                    ? auth_seq_id.getInteger(dataRow)
                    : `${auth_seq_id.getInteger(dataRow)} ${pdbx_PDB_ins_code.getString(dataRow)}`, residueCounter);
            }
        }

    }
}

type SecondaryStructureEntry = {
    startSeqNumber: number,
    startInsCode: string | null,
    endSeqNumber: number,
    endInsCode: string | null,
    type: SecondaryStructureType,
    rowIndex: number
}
type SecondaryStructureMap = FastMap<string, FastMap<number, SecondaryStructureEntry>>

function extendSecondaryStructureMap<T extends mmCIF.StructConf | mmCIF.StructSheetRange>(cat: mmCIF.Category<T>, type: SecondaryStructureType, map: SecondaryStructureMap) {
    if (!cat.rowCount) return;

    const { beg_label_asym_id, beg_label_seq_id, pdbx_beg_PDB_ins_code } = cat;
    const { end_label_seq_id, pdbx_end_PDB_ins_code } = cat;

    for (let i = 0; i < cat.rowCount; i++) {
        const entry: SecondaryStructureEntry = {
            startSeqNumber: beg_label_seq_id.getInteger(i),
            startInsCode: pdbx_beg_PDB_ins_code.getString(i),
            endSeqNumber: end_label_seq_id.getInteger(i),
            endInsCode: pdbx_end_PDB_ins_code.getString(i),
            type,
            rowIndex: i
        };

        const asymId = beg_label_asym_id.getString(i)!;
        if (map.has(asymId)) {
            map.get(asymId)!.set(entry.startSeqNumber, entry);
        } else {
            map.set(asymId, FastMap.ofArray([[entry.startSeqNumber, entry]]));
        }
    }

    return map;
}

function assignSecondaryStructureEntry(model: Model, entry: SecondaryStructureEntry, resStart: number, resEnd: number) {
    const { atomOffset } = model.residues;
    const { index: secondaryStructureIndex, type: secondaryStructureType } = model.secondaryStructure
    const { dataIndex } = model.atoms;
    const { label_seq_id, pdbx_PDB_ins_code } = model.data.atom_site;
    const { endSeqNumber, endInsCode, rowIndex, type } = entry;

    let rI = resStart;
    while (rI < resEnd) {
        const atomRowIndex = dataIndex[atomOffset[rI]];
        const seqNumber = label_seq_id.getInteger(atomRowIndex);

        if ((seqNumber > endSeqNumber) ||
            (seqNumber === endSeqNumber && pdbx_PDB_ins_code.getString(atomRowIndex) === endInsCode)) {
            break;
        }

        secondaryStructureIndex[rI] = rowIndex;
        secondaryStructureType[rI] = type;
        rI++;
    }
}

function assignSecondaryStructureRanges(model: Model) {
    const map: SecondaryStructureMap = FastMap.create();
    extendSecondaryStructureMap(model.data.secondaryStructure.structConf, SecondaryStructureType.StructConf, map);
    extendSecondaryStructureMap(model.data.secondaryStructure.sheetRange, SecondaryStructureType.StructSheetRange, map);

    const { residueOffset, count: chainCount } = model.chains;
    const { atomOffset } = model.residues;
    const { dataIndex } = model.atoms;
    const { label_asym_id, label_seq_id, pdbx_PDB_ins_code } = model.data.atom_site;

    for (let cI = 0; cI < chainCount; cI++) {
        const resStart = residueOffset[cI], resEnd = residueOffset[cI + 1];
        const asymId = label_asym_id.getString(dataIndex[atomOffset[resStart]])!;

        if (map.has(asymId)) {
            const entries = map.get(asymId)!;

            for (let rI = resStart; rI < resEnd; rI++) {
                const atomRowIndex = dataIndex[atomOffset[rI]];
                const seqNumber = label_seq_id.getInteger(atomRowIndex);
                if (entries.has(seqNumber)) {
                    const entry = entries.get(seqNumber)!;
                    const insCode = pdbx_PDB_ins_code.getString(atomRowIndex);
                    if (entry.startInsCode !== insCode) continue;
                    assignSecondaryStructureEntry(model, entry, rI, resEnd);
                }
            }
        }
    }
}

function assignSecondaryStructureKey(model: Model) {
    const { type, index, key } = model.secondaryStructure;
    const { count } = model.residues;
    const { sheet_id } = model.data.secondaryStructure.sheetRange;
    const helix_index_key = FastMap.create<number, number>();
    const sheet_id_key = FastMap.create<string, number>();
    let currentKey = 1;
    for (let i = 0; i < count; i++) {
        switch (type[i]) {
            case SecondaryStructureType.StructConf: {
                const idx = index[i];
                if (helix_index_key.has(idx)) key[i] = helix_index_key.get(idx)!;
                else {
                    key[i] = currentKey++;
                    helix_index_key.set(idx, key[i]);
                }
                break;
            }
            case SecondaryStructureType.StructSheetRange: {
                const sid = sheet_id.getString(index[i])!;
                if (sheet_id_key.has(sid)) key[i] = sheet_id_key.get(sid)!;
                else {
                    key[i] = currentKey++;
                    sheet_id_key.set(sid, key[i]);
                }
                break;
            }
        }
    }
}

function assignSecondaryStructureFlags(model: Model) {
    const { type: ssType, index: ssIndex, flags } = model.secondaryStructure;
    const { pdbx_PDB_helix_class, conf_type_id } = model.data.secondaryStructure.structConf;

    for (let rI = 0, _rI = model.residues.count; rI < _rI; rI++) {
        const type = ssType[rI];
        let flag = SecondaryStructureFlag.NA;
        switch (type) {
            case SecondaryStructureType.StructConf:
                const index = ssIndex[rI]
                const helixClass = pdbx_PDB_helix_class.getString(index)
                if (helixClass !== null) {
                    flag = SecondaryStructurePdb[helixClass]
                } else {
                    const confType = conf_type_id.getString(index)
                    if (confType !== null) flag = SecondaryStructureMmcif[confType]
                }
                break
            case SecondaryStructureType.StructSheetRange:
                flag = SecondaryStructureFlag.Beta | SecondaryStructureFlag.BetaSheet
        }
        flags[rI] = flag;
    }
}

function assignSecondaryStructure(model: Model) {
    assignSecondaryStructureRanges(model);
    assignSecondaryStructureKey(model);
    assignSecondaryStructureFlags(model);
}

function getModResMap(model: Model) {
    const modRes = model.data.pdbxStructModResidue;

    // map asymid/residue_number -> data index
    const map = FastMap.create<string, FastMap<number, number>>()

    const { label_asym_id, label_seq_id } = modRes;

    for (let i = 0; i < modRes.rowCount; i++) {
        const asymId = label_asym_id.getString(i)!, seqId = label_seq_id.getInteger(i);
        if (map.has(asymId)) {
            map.get(asymId)!.set(seqId, i);
        } else {
            map.set(asymId, FastMap.ofArray([[seqId, i]]));
        }
    }

    return map;
}

function assignModifiedResidues(model: Model) {
    const modRes = model.data.pdbxStructModResidue;
    if (!modRes.rowCount) return model;

    const map = getModResMap(model);

    const modResEntries = model.modifiedResidues as FastMap<number, number>;

    const { residueOffset, count: chainCount } = model.chains;
    const { atomOffset } = model.residues;
    const { dataIndex } = model.atoms;
    const { label_asym_id, label_seq_id, pdbx_PDB_ins_code } = model.data.atom_site;

    const { PDB_ins_code: modResInsCode } = modRes;

    for (let cI = 0; cI < chainCount; cI++) {
        const resStart = residueOffset[cI], resEnd = residueOffset[cI + 1];
        const asymId = label_asym_id.getString(dataIndex[atomOffset[resStart]])!;

        if (map.has(asymId)) {
            const entries = map.get(asymId)!;

            for (let rI = resStart; rI < resEnd; rI++) {
                const atomRowIndex = dataIndex[atomOffset[rI]];
                const seqNumber = label_seq_id.getInteger(atomRowIndex);
                if (entries.has(seqNumber)) {
                    const entry = entries.get(seqNumber)!;
                    if (pdbx_PDB_ins_code.getString(atomRowIndex) !== modResInsCode.getString(entry)) continue;
                    modResEntries.set(rI, entry);
                }
            }
        }
    }

    return map;
}

export default function parseCIF(cifData: string): Structure {
    const file = CIF.Text.parse(cifData);
    if (file.isError) throw new Error(file.toString());
    const dataBlock = file.result.dataBlocks[0];
    if (!dataBlock) throw new Error('No data block found.');

    const data: Model['data'] = {
        atom_site: mmCIF.Category(dataBlock.getCategory('_atom_site'), mmCIF.AtomSite),
        entity: mmCIF.Category(dataBlock.getCategory('_entity'), mmCIF.Entity),
        bonds: {
            chemCompBond: mmCIF.Category(dataBlock.getCategory('_chem_comp_bond'), mmCIF.ChemCompBond),
            structConn: mmCIF.Category(dataBlock.getCategory('_struct_conn'), mmCIF.StructConn),
        },
        secondaryStructure: {
            structConf: mmCIF.Category(dataBlock.getCategory('_struct_conf'), mmCIF.StructConf),
            sheetRange: mmCIF.Category(dataBlock.getCategory('_struct_sheet_range'), mmCIF.StructSheetRange)
        },
        pdbxStructModResidue: mmCIF.Category(dataBlock.getCategory('_pdbx_struct_mod_residue'), mmCIF.PDBxStructModResidue)
    };

    const models: Model[] = [];
    let modelStartIndex = 0;
    while (modelStartIndex < data.atom_site.rowCount) {
        const model = createModel(dataBlock.header, data, modelStartIndex, data.atom_site.rowCount);
        assignKeysAndDataIndices(model);
        assignSecondaryStructure(model);
        assignModifiedResidues(model);
        models.push(model);
        modelStartIndex += model.atoms.count;
    }
    return { id: dataBlock.header, models };
}