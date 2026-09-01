/* =========================================================
   STEPS MIND MAP
   Stable Interactive Mind Map Engine
   ========================================================= */


/* =========================================================
   DOM
   ========================================================= */

const markdownInput =
    document.getElementById("markdownInput");

const generateButton =
    document.getElementById("generateButton");

const imageInput =
    document.getElementById("imageInput");

const imagePreview =
    document.getElementById("imagePreview");

const inputPanel =
    document.getElementById("inputPanel");

const mapPanel =
    document.getElementById("mapPanel");

const svg =
    d3.select("#mindMap");


/* =========================================================
   STATE
   ========================================================= */

let mapData = null;
let hierarchyRoot = null;
let currentImage = null;
let zoomBehaviour = null;


/* =========================================================
   IMAGE
   ========================================================= */

if (imageInput) {

    imageInput.addEventListener(
        "change",
        function () {

            const file =
                this.files[0];

            if (!file) {

                currentImage = null;

                if (imagePreview) {
                    imagePreview.style.display = "none";
                    imagePreview.innerHTML = "";
                }

                return;
            }

            const reader =
                new FileReader();

            reader.onload =
                function (event) {

                    currentImage =
                        event.target.result;

                    if (imagePreview) {

                        imagePreview.innerHTML =
                            `<img src="${currentImage}" alt="Map image">`;

                        imagePreview.style.display =
                            "block";
                    }
                };

            reader.readAsDataURL(file);
        }
    );
}


/* =========================================================
   MARKDOWN PARSER
   ========================================================= */

function parseMarkdown(markdown) {

    const lines =
        markdown
            .replace(/\r\n/g, "\n")
            .split("\n");

    let root = null;

    const stack = [];


    for (let rawLine of lines) {

        const line =
            rawLine.replace(/\t/g, "    ");

        if (!line.trim()) {
            continue;
        }


        /* -------------------------------------------------
           HEADINGS
        ------------------------------------------------- */

        const heading =
            line.match(
                /^(#{1,6})\s+(.+)$/
            );


        if (heading) {

            const level =
                heading[1].length;

            const title =
                heading[2].trim();


            const node = {

                title: title,

                level: level,

                type: "heading",

                children: [],

                collapsed: false
            };


            /* ROOT */

            if (!root) {

                root = node;

                stack.length = 0;

                stack.push(node);

                continue;
            }


            /*
               If another level-1 heading appears,
               treat it as a new root.
            */

            if (level === 1) {

                root = node;

                stack.length = 0;

                stack.push(node);

                continue;
            }


            /* FIND PARENT */

            while (
                stack.length &&
                stack[stack.length - 1].level >= level
            ) {

                stack.pop();
            }


            const parent =
                stack[
                    stack.length - 1
                ];


            if (parent) {

                parent.children.push(node);

                stack.push(node);
            }

            continue;
        }


        /* -------------------------------------------------
           BULLETS
        ------------------------------------------------- */

        const bullet =
            line.match(
                /^\s*[-*+]\s+(.+)$/
            );


        if (bullet) {

            const node = {

                title:
                    bullet[1].trim(),

                level: null,

                type: "detail",

                children: [],

                collapsed: false
            };


            const parent =
                stack[
                    stack.length - 1
                ];


            if (parent) {

                parent.children.push(node);
            }
        }
    }


    return root;
}


/* =========================================================
   BRANCH COLOURS
   ========================================================= */

function branchColor(node) {

    const colors = [

        "#3977c9",

        "#4f9a5a",

        "#d99427",

        "#8757a8",

        "#c45b5b",

        "#328f8f"

    ];


    let branch =
        node;


    while (
        branch.parent &&
        branch.parent.depth > 0
    ) {

        branch =
            branch.parent;
    }


    if (
        branch.parent &&
        branch.parent.children
    ) {

        const index =
            branch.parent.children.indexOf(
                branch
            );


        return colors[
            index % colors.length
        ];
    }


    return colors[0];
}


/* =========================================================
   NODE DIMENSIONS
   ========================================================= */

function nodeWidth(d) {

    if (d.depth === 0) {
        return 300;
    }


    if (d.depth === 1) {
        return 270;
    }


    if (d.depth === 2) {
        return 230;
    }


    return 190;
}


function nodeHeight(d) {

    if (d.depth === 0) {
        return 110;
    }


    if (d.depth === 1) {
        return 70;
    }


    if (d.depth === 2) {
        return 58;
    }


    return 46;
}


/* =========================================================
   TEXT WRAPPING
   ========================================================= */

function wrapText(selection, width) {

    selection.each(
        function (d) {

            const text =
                d3.select(this);

            const words =
                d.data.title
                    .split(/\s+/)
                    .reverse();


            let word;

            let line = [];

            const lines = [];


            const lineHeight =
                d.depth === 0
                    ? 25
                    : d.depth === 1
                        ? 19
                        : 16;


            const characterWidth =
                d.depth === 0
                    ? 12
                    : d.depth === 1
                        ? 8.5
                        : 7;


            while (
                (word = words.pop())
            ) {

                line.push(word);


                const test =
                    line.join(" ");


                if (
                    test.length *
                    characterWidth >
                    width &&
                    line.length > 1
                ) {

                    line.pop();

                    lines.push(
                        line.join(" ")
                    );

                    line = [word];
                }
            }


            if (line.length) {

                lines.push(
                    line.join(" ")
                );
            }


            const totalHeight =
                (
                    lines.length - 1
                ) *
                lineHeight;


            text.text(null);


            lines.forEach(
                function (
                    lineText,
                    index
                ) {

                    text

                        .append("tspan")

                        .attr(
                            "x",
                            0
                        )

                        .attr(
                            "dy",
                            index === 0
                                ? `${-totalHeight / 2}px`
                                : `${lineHeight}px`
                        )

                        .text(
                            lineText
                        );
                }
            );
        }
    );
}


/* =========================================================
   ZOOM
   ========================================================= */

function setupZoom() {

    zoomBehaviour =
        d3.zoom()

            .scaleExtent([
                0.25,
                3
            ])

            .filter(
                function (event) {

                    /*
                       Allow normal wheel zoom,
                       mouse dragging and buttons.
                    */

                    return true;
                }
            )

            .on(
                "zoom",
                function (event) {

                    svg

                        .select(
                            ".map-container"
                        )

                        .attr(
                            "transform",
                            event.transform
                        );
                }
            );


    svg.call(
        zoomBehaviour
    );
}


/* =========================================================
   LAYOUT
   ========================================================= */

function createLayout() {

    /*
       D3 tree:

       X = vertical position
       Y = horizontal position

       We deliberately normalise the tree so
       the root is ALWAYS at x = 0.

       This is the key to preventing the map
       from jumping when branches collapse.
    */


    const layout =
        d3.tree()
            .nodeSize([
                115,
                340
            ])

            .separation(
                function (a, b) {

                    /*
                       Nodes sharing a parent
                       get generous spacing.
                    */

                    if (
                        a.parent === b.parent
                    ) {

                        if (
                            a.depth === 1
                        ) {

                            return 1.45;
                        }


                        if (
                            a.depth === 2
                        ) {

                            return 1.25;
                        }


                        return 1.1;
                    }


                    return 1.6;
                }
            );


    layout(
        hierarchyRoot
    );


    /* -------------------------------------------------
       FIX ROOT VERTICAL POSITION
    ------------------------------------------------- */

    const rootX =
        hierarchyRoot.x;


    hierarchyRoot.each(
        function (d) {

            d.x -= rootX;
        }
    );


    /* -------------------------------------------------
       EXTRA PRIMARY BRANCH SPACING
    ------------------------------------------------- */

    if (
        hierarchyRoot.children &&
        hierarchyRoot.children.length > 1
    ) {

        const children =
            hierarchyRoot.children;


        const minimumGap =
            145;


        for (
            let i = 1;
            i < children.length;
            i++
        ) {

            const previous =
                children[i - 1];

            const current =
                children[i];


            const gap =
                current.x -
                previous.x;


            if (
                gap < minimumGap
            ) {

                const adjustment =
                    minimumGap -
                    gap;


                current.each(
                    function (d) {

                        d.x +=
                            adjustment;
                    }
                );
            }
        }
    }
}


/* =========================================================
   LINK PATH
   ========================================================= */

function createLinkPath(d) {

    const sourceRight =
        d.source.y +
        nodeWidth(d.source) / 2;


    const targetLeft =
        d.target.y -
        nodeWidth(d.target) / 2;


    const middle =
        (
            sourceRight +
            targetLeft
        ) / 2;


    return `
        M ${sourceRight},${d.source.x}
        C ${middle},${d.source.x}
          ${middle},${d.target.x}
          ${targetLeft},${d.target.x}
    `;
}


/* =========================================================
   RENDER MIND MAP
   ========================================================= */

function renderMindMap(
    tree,
    fitAfterRender = false
) {

    if (!tree) {
        return;
    }


    /*
       SAVE CAMERA

       This is critical.
       When a branch is opened or closed,
       the map is redrawn but the user's
       current zoom and position remain.
    */

    const previousTransform =
        d3.zoomTransform(
            svg.node()
        );


    svg.selectAll("*")
        .remove();


    /* -------------------------------------------------
       ZOOM
    ------------------------------------------------- */

    setupZoom();


    /* -------------------------------------------------
       MAIN CONTAINER
    ------------------------------------------------- */

    const container =
        svg
            .append("g")
            .attr(
                "class",
                "map-container"
            );


    /* -------------------------------------------------
       HIERARCHY
    ------------------------------------------------- */

    hierarchyRoot =
        d3.hierarchy(
            tree,
            function (node) {

                if (
                    node.collapsed
                ) {

                    return null;
                }


                return node.children;
            }
        );


    /* -------------------------------------------------
       LAYOUT
    ------------------------------------------------- */

    createLayout();


    /* -------------------------------------------------
       LINKS
    ------------------------------------------------- */

    const linkGroup =
        container
            .append("g")
            .attr(
                "class",
                "links"
            );


    linkGroup

        .selectAll("path")

        .data(
            hierarchyRoot.links()
        )

        .join("path")

        .attr(
            "class",
            "map-link"
        )

        .attr(
            "fill",
            "none"
        )

        .attr(
            "stroke",
            function (d) {

                if (
                    d.target.depth === 1
                ) {

                    return branchColor(
                        d.target
                    );
                }


                return "#c4c7ca";
            }
        )

        .attr(
            "stroke-width",
            function (d) {

                if (
                    d.target.depth === 1
                ) {

                    return 4;
                }


                if (
                    d.target.depth === 2
                ) {

                    return 2.5;
                }


                return 1.5;
            }
        )

        .attr(
            "stroke-linecap",
            "round"
        )

        .attr(
            "d",
            createLinkPath
        );


/* =================================================
   NODES
   ================================================= */

const nodeGroup =
    container
        .append("g")
        .attr(
            "class",
            "nodes"
        );


const nodes =
    nodeGroup

        .selectAll("g")

        .data(
            hierarchyRoot.descendants()
        )

        .join("g")

        .attr(
            "class",
            function (d) {

                if (
                    d.depth === 0
                ) {

                    return "mind-node root-node";
                }


                if (
                    d.depth === 1
                ) {

                    return "mind-node major-node";
                }


                if (
                    d.depth === 2
                ) {

                    return "mind-node secondary-node";
                }


                return "mind-node detail-node";
            }
        )

        .attr(
            "transform",
            function (d) {

                return `
                    translate(
                        ${d.y},
                        ${d.x}
                    )
                `;
            }
        );


/* =================================================
   NODE CARD
   ================================================= */

nodes

    .append("rect")

    .attr(
        "class",
        "node-card"
    )

    .attr(
        "x",
        d =>
            -nodeWidth(d) / 2
    )

    .attr(
        "y",
        d =>
            -nodeHeight(d) / 2
    )

    .attr(
        "width",
        d =>
            nodeWidth(d)
    )

    .attr(
        "height",
        d =>
            nodeHeight(d)
    )

    .attr(
        "rx",
        d =>
            d.depth === 0
                ? 20
                : 14
    )

    .attr(
        "ry",
        d =>
            d.depth === 0
                ? 20
                : 14
    )

    .attr(
        "fill",
        "#ffffff"
    )

    .attr(
        "stroke",
        function (d) {

            if (
                d.depth === 0
            ) {

                return "#20242a";
            }


            if (
                d.depth === 1
            ) {

                return branchColor(d);
            }


            return "#d3d6da";
        }
    )

    .attr(
        "stroke-width",
        function (d) {

            if (
                d.depth === 0
            ) {

                return 3;
            }


            if (
                d.depth === 1
            ) {

                return 2.5;
            }


            return 1.5;
        }
    );


/* =================================================
   PRIMARY COLOUR ACCENT
   ================================================= */

nodes

    .filter(
        d =>
            d.depth === 1
    )

    .append("rect")

    .attr(
        "class",
        "node-accent"
    )

    .attr(
        "x",
        d =>
            -nodeWidth(d) / 2
    )

    .attr(
        "y",
        d =>
            -nodeHeight(d) / 2
    )

    .attr(
        "width",
        7
    )

    .attr(
        "height",
        d =>
            nodeHeight(d)
    )

    .attr(
        "rx",
        3
    )

    .attr(
        "fill",
        d =>
            branchColor(d)
    );


/* =================================================
   TEXT
   ================================================= */

const text =
    nodes

        .append("text")

        .attr(
            "class",
            function (d) {

                if (
                    d.depth === 0
                ) {

                    return "node-title root-title";
                }


                if (
                    d.data.type ===
                    "detail"
                ) {

                    return "node-detail";
                }


                return "node-title";
            }
        )

        .attr(
            "text-anchor",
            "middle"
        )

        .attr(
            "dominant-baseline",
            "middle"
        )

        .attr(
            "font-size",
            function (d) {

                if (
                    d.depth === 0
                ) {

                    return "24px";
                }


                if (
                    d.depth === 1
                ) {

                    return "17px";
                }


                if (
                    d.depth === 2
                ) {

                    return "14px";
                }


                return "12px";
            }
        )

        .attr(
            "font-weight",
            d =>
                d.depth <= 1
                    ? 700
                    : 400
        )

        .attr(
            "fill",
            function (d) {

                if (
                    d.depth === 0
                ) {

                    return "#20242a";
                }


                if (
                    d.data.type ===
                    "detail"
                ) {

                    return "#62676d";
                }


                return "#252a30";
            }
        );


wrapText(
    text,
    205
);


/* =================================================
   EXPANDABLE NODES
   ================================================= */

const expandable =
    nodes.filter(
        function (d) {

            return (
                d.data.children &&
                d.data.children.length > 0
            );
        }
    );


/* =================================================
   EXPAND BUTTON CIRCLE
   ================================================= */

expandable

    .append("circle")

    .attr(
        "class",
        "expand-button"
    )

    .attr(
        "cx",
        d =>
            nodeWidth(d) / 2 - 18
    )

    .attr(
        "cy",
        d =>
            -nodeHeight(d) / 2 + 18
    )

    .attr(
        "r",
        12
    )

    .attr(
        "fill",
        "#ffffff"
    )

    .attr(
        "stroke",
        d =>
            branchColor(d)
    );

 The root and primary branches are deliberately
       positioned independently of the height of their
       descendants.

       This prevents expanding one primary branch from
       pushing the other primary branches up or down.

       D3 coordinates used by this application:

           x = vertical position
           y = horizontal position

       Structure:

           ROOT -> PRIMARY -> SECONDARY -> DETAIL
    ------------------------------------------------- */

    if (!hierarchyRoot) {
        return;
    }


    /* -------------------------------------------------
       HORIZONTAL POSITIONS
    ------------------------------------------------- */

    const PRIMARY_Y = 360;
    const SECONDARY_Y = 680;
    const DETAIL_Y = 980;


    /* -------------------------------------------------
       PRIMARY BRANCH POSITIONS

       These are fixed relative to the root.
       The number can be adjusted later if necessary,
       but it should NOT depend on subtree height.
    ------------------------------------------------- */

    const PRIMARY_SPACING = 175;


    hierarchyRoot.x = 0;
    hierarchyRoot.y = 0;


    if (
        !hierarchyRoot.children ||
        hierarchyRoot.children.length === 0
    ) {
        return;
    }


    const primaryBranches =
        hierarchyRoot.children;


    const primaryMiddle =
        (primaryBranches.length - 1) / 2;


    primaryBranches.forEach(
        function (primary, index) {

            primary.x =
                (
                    index -
                    primaryMiddle
                ) *
                PRIMARY_SPACING;

            primary.y =
                PRIMARY_Y;
        }
    );


    /* -------------------------------------------------
       SECONDARY BRANCHES

       Each primary branch gets its own local group.
       The secondary nodes are therefore positioned
       around the primary rather than affecting the
       position of the other primary branches.
    ------------------------------------------------- */

    const SECONDARY_SPACING = 95;


    primaryBranches.forEach(
        function (primary) {

            if (
                primary.data.collapsed ||
                !primary.children ||
                primary.children.length === 0
            ) {
                return;
            }


            const secondary =
                primary.children;


            const secondaryMiddle =
                (secondary.length - 1) / 2;


            secondary.forEach(
                function (child, index) {

                    child.x =
                        primary.x +
                        (
                            index -
                            secondaryMiddle
                        ) *
                        SECONDARY_SPACING;

                    child.y =
                        SECONDARY_Y;


                    /* ---------------------------------
                       DETAIL NODES
                    --------------------------------- */

                    if (
                        child.data.collapsed ||
                        !child.children ||
                        child.children.length === 0
                    ) {
                        return;
                    }


                    const details =
                        child.children;


                    const DETAIL_SPACING = 58;


                    const detailMiddle =
                        (details.length - 1) / 2;


                    details.forEach(
                        function (detail, detailIndex) {

                            detail.x =
                                child.x +
                                (
                                    detailIndex -
                                    detailMiddle
                                ) *
                                DETAIL_SPACING;

                            detail.y =
                                DETAIL_Y;


                            positionDeeperNodes(
                                detail
                            );
                        }
                    );
                }
            );
        }
    );
}


/* =========================================================
   DEEPER LEVELS
========================================================= */

function positionDeeperNodes(node) {

    if (
        !node ||
        node.data.collapsed ||
        !node.children ||
        node.children.length === 0
    ) {
        return;
    }


    const DEEPER_Y_GAP = 270;
    const DEEPER_X_GAP = 50;


    const children =
        node.children;


    const middle =
        (children.length - 1) / 2;


    children.forEach(
        function (child, index) {

            child.x =
                node.x +
                (
                    index -
                    middle
                ) *
                DEEPER_X_GAP;

            child.y =
                node.y +
                DEEPER_Y_GAP;


            positionDeeperNodes(
                child
            );
        }
    );
}


/* =========================================================
   RENDER MIND MAP
========================================================= */

function renderMindMap(
    tree,
    fitAfterRender = false
) {

    if (!tree) {
        return;
    }


    /*
       Save current camera.

       This prevents the map from jumping
       when a branch is expanded or collapsed.
    */

    const previousTransform =
        d3.zoomTransform(
            svg.node()
        );


    svg.selectAll("*")
        .remove();


    /* -------------------------------------------------
       ZOOM
    ------------------------------------------------- */

    setupZoom();


    /* -------------------------------------------------
       CONTAINER
    ------------------------------------------------- */

    const container =
        svg
            .append("g")
            .attr(
                "class",
                "map-container"
            );


    /* -------------------------------------------------
       HIERARCHY
    ------------------------------------------------- */

    hierarchyRoot =
        d3.hierarchy(
            tree,
            function (node) {

                if (
                    node.collapsed
                ) {

                    return null;
                }


                return node.children;
            }
        );


    /* -------------------------------------------------
       LAYOUT
    ------------------------------------------------- */

    createLayout();


    /* -------------------------------------------------
       LINKS
    ------------------------------------------------- */

    const linkGroup =
        container
            .append("g")
            .attr(
                "class",
                "links"
            );


    linkGroup
        .selectAll("path")
        .data(
            hierarchyRoot.links()
        )
        .join("path")

        .attr(
            "class",
            "map-link"
        )

        .attr(
            "fill",
            "none"
        )

        .attr(
            "stroke",
            function (d) {

                if (
                    d.target.depth === 1
                ) {

                    return branchColor(
                        d.target
                    );
                }


                return "#c4c7ca";
            }
        )

        .attr(
            "stroke-width",
            function (d) {

                if (
                    d.target.depth === 1
                ) {

                    return 4;
                }


                if (
                    d.target.depth === 2
                ) {

                    return 2.5;
                }


                return 1.5;
            }
        )

        .attr(
            "stroke-linecap",
            "round"
        )

        .attr(
            "d",
            function (d) {

                const sourceRight =
                    d.source.y +
                    nodeWidth(
                        d.source
                    ) / 2;


                const targetLeft =
                    d.target.y -
                    nodeWidth(
                        d.target
                    ) / 2;


                const middle =
                    (
                        sourceRight +
                        targetLeft
                    ) / 2;


                return `
                    M ${sourceRight},${d.source.x}
                    C ${middle},${d.source.x}
                      ${middle},${d.target.x}
                      ${targetLeft},${d.target.x}
                `;
            }
        );


    /* -------------------------------------------------
       NODES
    ------------------------------------------------- */

    const nodeGroup =
        container
            .append("g")
            .attr(
                "class",
                "nodes"
            );


    const nodes =
        nodeGroup
            .selectAll("g")
            .data(
                hierarchyRoot.descendants()
            )
            .join("g")

            .attr(
                "class",
                function (d) {

                    if (
                        d.depth === 0
                    ) {

                        return "mind-node root-node";
                    }


                    if (
                        d.depth === 1
                    ) {

                        return "mind-node major-node";
                    }


                    if (
                        d.depth === 2
                    ) {

                        return "mind-node secondary-node";
                    }


                    return "mind-node detail-node";
                }
            )

            .attr(
                "transform",
                function (d) {

                    return `
                        translate(
                            ${d.y},
                            ${d.x}
                        )
                    `;
                }
            );


    /* -------------------------------------------------
       NODE CARD
    ------------------------------------------------- */

    nodes
        .append("rect")

        .attr(
            "class",
            "node-card"
        )
    .attr(
            "x",
            d =>
                -nodeWidth(d) / 2
        )

        .attr(
            "y",
            d =>
                -nodeHeight(d) / 2
        )

        .attr(
            "width",
            d =>
                nodeWidth(d)
        )

        .attr(
            "height",
            d =>
                nodeHeight(d)
        )

        .attr(
            "rx",
            d =>
                d.depth === 0
                    ? 20
                    : 14
        )

        .attr(
            "ry",
            d =>
                d.depth === 0
                    ? 20
                    : 14
        )

        .attr(
            "fill",
            "#ffffff"
        )

        .attr(
            "stroke",
            function (d) {

                if (
                    d.depth === 0
                ) {

                    return "#20242a";
                }


                if (
                    d.depth === 1
                ) {

                    return branchColor(d);
                }


                return "#d3d6da";
            }
        )

        .attr(
            "stroke-width",
            function (d) {

                if (
                    d.depth === 0
                ) {

                    return 3;
                }


                if (
                    d.depth === 1
                ) {

                    return 2.5;
                }


                return 1.5;
            }
        );


    /* -------------------------------------------------
       PRIMARY COLOUR ACCENT
    ------------------------------------------------- */

    nodes
        .filter(
            d =>
                d.depth === 1
        )

        .append("rect")

        .attr(
            "class",
            "node-accent"
        )

        .attr(
            "x",
            d =>
                -nodeWidth(d) / 2
        )

        .attr(
            "y",
            d =>
                -nodeHeight(d) / 2
        )

        .attr(
            "width",
            7
        )

        .attr(
            "height",
            d =>
                nodeHeight(d)
        )

        .attr(
            "rx",
            3
        )

        .attr(
            "fill",
            d =>
                branchColor(d)
        );


    /* -------------------------------------------------
       TEXT
    ------------------------------------------------- */

    const text =
        nodes
            .append("text")

            .attr(
                "class",
                function (d) {

                    if (
                        d.depth === 0
                    ) {

                        return "node-title root-title";
                    }


                    if (
                        d.data.type ===
                        "detail"
                    ) {

                        return "node-detail";
                    }


                    return "node-title";
                }
            )

            .attr(
                "text-anchor",
                "middle"
            )

            .attr(
                "dominant-baseline",
                "middle"
            )

            .attr(
                "font-size",
                function (d) {

                    if (
                        d.depth === 0
                    ) {

                        return "24px";
                    }


                    if (
                        d.depth === 1
                    ) {

                        return "17px";
                    }


                    if (
                        d.depth === 2
                    ) {

                        return "14px";
                    }


                    return "12px";
                }
            )

            .attr(
                "font-weight",
                d =>
                    d.depth <= 1
                        ? 700
                        : 400
            )

            .attr(
                "fill",
                function (d) {

                    if (
                        d.depth === 0
                    ) {

                        return "#20242a";
                    }


                    if (
                        d.data.type ===
                        "detail"
                    ) {

                        return "#62676d";
                    }


                    return "#252a30";
                }
            );


    wrapText(
        text,
        190
    );


    /* -------------------------------------------------
       EXPANDABLE NODES
    ------------------------------------------------- */

    const expandable =
        nodes.filter(
            function (d) {

                return (
                    d.data.children &&
                    d.data.children.length > 0
                );
            }
        );


    /* -------------------------------------------------
       CONTROL CIRCLE
    ------------------------------------------------- */

    expandable
        .append("circle")

        .attr(
            "class",
            "expand-button"
        )

        .attr(
            "cx",
            d =>
                nodeWidth(d) / 2 - 18
        )

        .attr(
            "cy",
            d =>
                -nodeHeight(d) / 2 + 18
        )

        .attr(
            "r",
            12
        )

        .attr(
            "fill",
            "#ffffff"
        )

        .attr(
            "stroke",
            d =>
                branchColor(d)
        )

        .attr(
            "stroke-width",
            2
        );


    /* -------------------------------------------------
       PLUS / MINUS
    ------------------------------------------------- */

    expandable
        .append("text")

        .attr(
            "class",
            "expand-symbol"
        )

        .attr(
            "x",
            d =>
                nodeWidth(d) / 2 - 18
        )

        .attr(
            "y",
            d =>
                -nodeHeight(d) / 2 + 19
        )

        .attr(
            "text-anchor",
            "middle"
        )

        .attr(
            "dominant-baseline",
            "middle"
        )

        .attr(
            "font-size",
            "13px"
        )

        .attr(
            "font-weight",
            700
        )

        .attr(
            "fill",
            d =>
                branchColor(d)
        )

        .text(
            d =>
                d.data.collapsed
                    ? "+"
                    : "−"
        );


    /* -------------------------------------------------
       ROOT IMAGE
    ------------------------------------------------- */

    if (currentImage) {

        const rootNode =
            nodes.filter(
                d =>
                    d.depth === 0
            );


        const clipId =
            "root-image-clip";


        rootNode
            .append("clipPath")
            .attr(
                "id",
                clipId
            )

            .append("rect")

            .attr(
                "x",
                -nodeWidth(
                    hierarchyRoot
                ) / 2 + 14
            )

            .attr(
                "y",
                -nodeHeight(
                    hierarchyRoot
                ) / 2 + 14
            )

            .attr(
                "width",
                70
            )

            .attr(
                "height",
                nodeHeight(
                    hierarchyRoot
                ) - 28
            )

            .attr(
                "rx",
                10
            );


        rootNode
            .append("image")

            .attr(
                "href",
                currentImage
            )

            .attr(
                "class",
                "root-image"
            )

            .attr(
                "x",
                -nodeWidth(
                    hierarchyRoot
                ) / 2 + 14
            )

            .attr(
                "y",
                -nodeHeight(
                    hierarchyRoot
                ) / 2 + 14
            )

            .attr(
                "width",
                70
            )

            .attr(
                "height",
                nodeHeight(
                    hierarchyRoot
                ) - 28
            )

            .attr(
                "preserveAspectRatio",
                "xMidYMid slice"
            )

            .attr(
                "clip-path",
                `url(#${clipId})`
            );
    }


    /* -------------------------------------------------
       EXPAND / COLLAPSE
    ------------------------------------------------- */

    expandable.on(
        "click",
        function (
            event,
            d
        ) {
             event.stopPropagation();


            /*
               Change the actual DATA node.
            */

            d.data.collapsed =
                !d.data.collapsed;


            /*
               Re-render without Fit Map.

               The camera is restored afterwards.
            */

            renderMindMap(
                mapData,
                false
            );
        }
    );


    /* -------------------------------------------------
       RESTORE CAMERA
    ------------------------------------------------- */

    if (!fitAfterRender) {

        svg.call(
            zoomBehaviour.transform,
            previousTransform
        );
    }


    /* -------------------------------------------------
       INITIAL FIT
    ------------------------------------------------- */

    if (fitAfterRender) {

        setTimeout(
            function () {

                fitMap();

            },
            50
        );
    }
}


/* =========================================================
   FIT MAP
========================================================= */

function fitMap() {

    if (
        !hierarchyRoot ||
        !zoomBehaviour
    ) {

        return;
    }


    const container =
        d3.select(
            "#mindMap .map-container"
        );


    if (
        !container.node()
    ) {

        return;
    }


    const width =
        svg.node().clientWidth;


    const height =
        svg.node().clientHeight;


    const bounds =
        container
            .node()
            .getBBox();


    if (
        !bounds.width ||
        !bounds.height
    ) {

        return;
    }


    const horizontalPadding =
        80;


    const verticalPadding =
        60;


    const availableWidth =
        width -
        horizontalPadding * 2;


    const availableHeight =
        height -
        verticalPadding * 2;


    const scaleX =
        availableWidth /
        bounds.width;


    const scaleY =
        availableHeight /
        bounds.height;


    let scale =
        Math.min(
            scaleX,
            scaleY
        );


    /*
       Keep map readable.
    */

    scale =
        Math.max(
            0.55,
            Math.min(
                1.25,
                scale
            )
        );


    /*
       Keep root toward the left side
       instead of centering it.
    */

    const targetRootX =
        width * 0.27;


    const targetRootY =
        height * 0.50;


    svg.transition()
        .duration(400)
        .call(
            zoomBehaviour.transform,
            d3.zoomIdentity
                .translate(
                    targetRootX,
                    targetRootY
                )
                .scale(
                    scale
                )
        );
}


/* =========================================================
   ZOOM IN
========================================================= */

const zoomInButton =
    document.getElementById(
        "zoomInButton"
    );


if (zoomInButton) {

    zoomInButton.addEventListener(
        "click",
        function () {

            if (!zoomBehaviour) {
                return;
            }


            svg.transition()
                .call(
                    zoomBehaviour.scaleBy,
                    1.25
                );
        }
    );
}


/* =========================================================
   ZOOM OUT
========================================================= */

const zoomOutButton =
    document.getElementById(
        "zoomOutButton"
    );


if (zoomOutButton) {

    zoomOutButton.addEventListener(
        "click",
        function () {

            if (!zoomBehaviour) {
                return;
            }


            svg.transition()
                .call(
                    zoomBehaviour.scaleBy,
                    0.8
                );
        }
    );
}


/* =========================================================
   FIT BUTTON
========================================================= */

const fitButton =
    document.getElementById(
        "fitButton"
    );


if (fitButton) {

    fitButton.addEventListener(
        "click",
        function () {

            fitMap();
        }
    );
}


/* =========================================================
   GENERATE MAP
========================================================= */

if (generateButton) {

    generateButton.addEventListener(
        "click",
        function () {

            const markdown =
                markdownInput.value.trim();


            if (!markdown) {

                alert(
                    "Please enter a Markdown mind map first."
                );

                return;
            }


            const tree =
                parseMarkdown(
                    markdown
                );


            if (!tree) {

                alert(
                    "The Markdown could not be interpreted."
                );

                return;
            }


            /*
               Store the actual DATA tree.

               Collapse / expand changes this object,
               so the state survives re-rendering.
            */

            mapData =
                tree;


            if (inputPanel) {

                inputPanel.classList.add(
                    "hidden"
                );
            }


            if (mapPanel) {

                mapPanel.classList.remove(
                    "hidden"
                );
            }


            renderMindMap(
                mapData,
                true
            );
        }
    );
}


