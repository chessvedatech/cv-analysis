/*
 * cv-analysis — Chessveda's chess analysis service
 * Copyright (C) 2026 Midas 24x7 Games Private Limited
 *
 * This file is derived from WintrChess
 * (https://github.com/WintrCat/wintrchess), Copyright (C) WintrCat and
 * contributors, and was modified by Midas 24x7 Games Private Limited
 * in 2026. See the NOTICE file for the list of derived files and what
 * changed.
 *
 * This program is free software: you can redistribute it and/or modify it
 * under the terms of the GNU General Public License as published by the Free
 * Software Foundation, either version 3 of the License, or (at your option)
 * any later version.
 *
 * This program is distributed in the hope that it will be useful, but WITHOUT
 * ANY WARRANTY; without even the implied warranty of MERCHANTABILITY or
 * FITNESS FOR A PARTICULAR PURPOSE. See the GNU General Public License for
 * more details. You should have received a copy of the licence along with
 * this program; see the LICENSE file.
 */

import { z } from "zod";
import { Chess } from "chess.js";
import { clone, uniqueId } from "lodash";

import { boardStateSchema } from "./BoardState";
import PieceColour from "@/constants/PieceColour";

export const stateTreeNodeSchema = z.object({
    id: z.string(),
    mainline: z.boolean(),
    state: boardStateSchema,
    get children(): z.ZodArray<typeof stateTreeNodeSchema> {
        return stateTreeNodeSchema.array();
    },
    get parent(): z.ZodOptional<typeof stateTreeNodeSchema> {
        return stateTreeNodeSchema.optional();
    }
});

export type StateTreeNode = z.infer<typeof stateTreeNodeSchema>;

export type SerializedStateTreeNode = (
    Omit<StateTreeNode, "children" | "parent">
    & { children: SerializedStateTreeNode[] }
);

/**
 * @description Remove parent from node, and recurse through all children to
 * remove their parents, to remove cyclic references so the tree can be
 * JSON-encoded.
 */
export function serializeNode(rootNode: StateTreeNode) {
    function serializePart(part: StateTreeNode): SerializedStateTreeNode {
        part.parent = undefined;

        part.children = part.children.map(
            child => serializePart(clone(child))
        );

        return part as SerializedStateTreeNode;
    }

    return serializePart(clone(rootNode));
}

/**
 * @description Recurses through children of a node N, setting their parents
 * back to N.
 */
export function deserializeNode(serializedRoot: SerializedStateTreeNode) {
    function deserializePart(
        node: SerializedStateTreeNode,
        parent?: StateTreeNode
    ) {
        const deserializedNode: StateTreeNode = {
            ...node,
            parent: parent,
            children: []
        };

        deserializedNode.children = node.children.map(
            child => deserializePart(child, deserializedNode)
        );

        return deserializedNode;
    }

    return deserializePart(serializedRoot);
}

/**
 * @description Returns a list of the given node and its entire line of
 * priority children, or all children unordered if `expand` is true.
 */
export function getNodeChain(rootNode: StateTreeNode, expand?: boolean) {
    const chain: StateTreeNode[] = [];

    const frontier: StateTreeNode[] = [rootNode];

    while (frontier.length > 0) {
        const current = frontier.pop();
        if (!current) break;

        chain.push(current);

        for (const child of current.children) {
            frontier.push(child);

            if (!expand) break;
        }
    }

    return chain;
}

/**
 * @description Adds a child to the node based on the SAN move given;
 * returns the added node.
 */
export function addChildMove(node: StateTreeNode, san: string) {
    const existingNode = node.children.find(
        child => child.state.move?.san == san
    );

    const childMove = new Chess(node.state.fen).move(san);

    const createdNode: StateTreeNode = {
        id: uniqueId(),
        mainline: node.mainline && !node.children.some(
            child => child.mainline
        ),
        parent: node,
        children: [],
        state: {
            fen: childMove.after,
            engineLines: [],
            move: {
                san: childMove.san,
                uci: childMove.lan
            },
            moveColour: childMove.color == "w"
                ? PieceColour.WHITE
                : PieceColour.BLACK
        }
    };

    if (!existingNode) {
        node.children.push(createdNode);
    }

    return existingNode || createdNode;
}
