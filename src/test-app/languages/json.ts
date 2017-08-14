/*
 * Copyright (c) 2017 MolQL contributors, licensed under MIT, See LICENSE file for more info.
 *
 * @author David Sehnal <david.sehnal@gmail.com>
 */

import Language from './language'
import Container from '../../reference-implementation/molql/container'
import Transpilers from '../../transpilers/all'
import B from '../../molql/builder'

const l = B.core.type.list;
const lys = B.struct.generator.atomGroups({
    'residue-test': B.core.rel.eq([B.ammp('auth_comp_id'), 'LYS']),
    'group-by': B.ammp('residueKey')
});

const lang: Language = {
    name: 'JSON',
    editorMode: 'javascript',
    transpiler: Transpilers.json,
    examples: [{
        name: 'All C or N atoms in ALA residues',
        value: Container.serialize(
            B.struct.generator.atomGroups({
                'residue-test': B.core.rel.eq([B.ammp('auth_comp_id'), 'ALA']),
                'atom-test': B.core.set.has([
                    B.core.type.set([B.es('C'), B.es('N')]),
                    B.acp('elementSymbol')
                ])
            }), { source: 'test-app', pretty: true })
    }, {
        name: 'All residues within 5 ang from Fe atom',
        value: Container.serialize(B.struct.modifier.includeSurroundings({
            'selection': B.struct.generator.atomGroups({
                'atom-test': B.core.rel.eq([B.acp('elementSymbol'), B.es('Fe')]),
            }),
            'radius': 5,
            'as-whole-residues': true
        }), { source: 'test-app', pretty: true })
    }, {
        name: 'Cluster LYS residues within 5 ang',
        value: Container.serialize(B.struct.modifier.cluster({
            'selection': lys,
            'max-distance': 5
        }), { source: 'test-app', pretty: true })
    }, {
        name: 'Cluster 3 LYS residues within 5 ang',
        value: Container.serialize(B.struct.combinator.distanceCluster({
            matrix: l([l([0, 5, 5]), l([0, 0, 5]), l([0, 0, 0])]),
            selections: l([lys, lys, lys])
        }), { source: 'test-app', pretty: true })
    }, {
        name: 'Residues with max b-factor < 45',
        value: Container.serialize(B.struct.filter.pick({
            selection: B.struct.generator.atomGroups({ 'group-by': B.ammp('residueKey') }),
            test: B.core.rel.lt([
                B.struct.atomSet.reduce({
                    initial: B.ammp('B_iso_or_equiv'),
                    value: B.core.math.max([
                        B.struct.slot.atomSetReduce(),
                        B.ammp('B_iso_or_equiv')
                    ])
                }),
                35
            ])
        }), { source: 'test-app', pretty: true })
    }]
}

export default lang