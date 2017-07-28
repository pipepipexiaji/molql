/*
 * Copyright (c) 2017 David Sehnal, licensed under MIT, See LICENSE file for more info.
 */

import * as MolData from '../molecule/data'
import Mask from '../utils/mask'
import AtomSet from './atom-set'
import AtomSelection from './atom-selection'

interface Context {
    readonly model: MolData.Model,
    readonly mask: Mask
}

function Context(model: MolData.Model, mask: Mask): Context {
    return { model, mask };
}

namespace Context {
    export interface ElementAddress { dataIndex: number, atom: number, residue: number, chain: number, entity: number }
    export function ElementAddress(): ElementAddress { return { dataIndex: 0, atom: 0, residue: 0, chain: 0, entity: 0 }; }

    export function ofAtomSet(model: MolData.Model, atomSet: AtomSet) {
        return Context(model, Mask.ofIndices(model.atoms.count, atomSet.atomIndices));
    }

    export function ofAtomSelection(model: MolData.Model, atomSelection: AtomSelection) {
        return Context(model, AtomSelection.getMask(atomSelection));
    }

    export function ofModel(model: MolData.Model) {
        return Context(model, Mask.always);
    }

    export namespace ElementAddress {
        export function setAtom(ctx: Context, address: ElementAddress, atomIndex: number) {
            const { atoms: { dataIndex } } = ctx.model;
            address.atom = atomIndex;
            address.dataIndex = dataIndex[atomIndex];
        }

        export function setResidue(ctx: Context, address: ElementAddress, residueIndex: number) {
            const { residues: { atomStartIndex }, atoms: { dataIndex } } = ctx.model;
            address.atom = atomStartIndex[residueIndex];
            address.dataIndex = dataIndex[address.atom];
            address.residue = residueIndex;
        }

        export function setChain(ctx: Context, address: ElementAddress, chainIndex: number) {
            const { residues: { atomStartIndex }, chains: { residueStartIndex }, atoms: { dataIndex } } = ctx.model;
            address.chain = chainIndex;
            address.residue = residueStartIndex[chainIndex];
            address.atom = atomStartIndex[address.residue];
            address.dataIndex = dataIndex[address.atom];
        }

        export function setEntity(ctx: Context, address: ElementAddress, entityIndex: number) {
            const { residues: { atomStartIndex }, chains: { residueStartIndex }, entities: { chainStartIndex }, atoms: { dataIndex } } = ctx.model;
            address.entity = entityIndex;
            address.chain = chainStartIndex[entityIndex];
            address.residue = residueStartIndex[address.chain];
            address.atom = atomStartIndex[address.residue];
            address.dataIndex = dataIndex[address.atom];
        }
    }
}

export default Context;