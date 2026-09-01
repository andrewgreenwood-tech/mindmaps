/* =========================================================
   MIND MAP GENERATOR
   Version 6 — Stable Anchored Layout
   =========================================================

   DESIGN PRINCIPLES

   1. The root is the permanent visual anchor.
   2. Expanding/collapsing never calls Fit Map.
   3. Zoom/pan is preserved during re-render.
   4. Primary branches are distributed around the root.
   5. Each subtree receives enough vertical space.
   6. Markdown remains the source structure.
   7. Optional image can be displayed in the root.
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

const fitButton =
    document.getElementById("fitButton");

const zoomInButton =
    document.getElementById("zoomInButton");

const zoomOutButton =
    document.getElementById("zoomOutButton");


/* =========================================================
   STATE
========================================================= */

let root = null;

let currentTree = null;

let zoomBehaviour = null;

let currentImage = null;


/*
   The logical root position never changes.

   The actual screen position is controlled by
   the zoom transform.
*/
const ROOT_LOGICAL_X = 0;


/* =========================================================
   BRANCH COLOURS
========================================================= */

const BRANCH_COLORS = [
    "#3977c9",
    "#4f9a5a",
    "#d99427",
    "#8757a8",
    "#c45b5b",
    "#328f8f"
];


function branchColor(node) {

    let branch = node;

    while (
        branch.parent &&
        branch.parent.depth > 0
    ) {
        branch = branch.parent;
    }

    if (
        branch.parent &&
        branch.parent.children
    ) {

        const index =
            branch.parent.children.indexOf(
                branch
            );

        return (
            BRANCH_COLORS[
                index % BRANCH_COLORS.length
            ]
        );
    }

    return BRANCH_COLORS[0];
}


/* =========================================================
   IMAGE HANDLING
========================================================= */

if (imageInput) {

    imageInput.addEventListener(
        "change",
        function () {

            const file =
                this.files &&
                this.files[0];

            if (!file) {

                currentImage = null;

                if (imagePreview) {

                    imagePreview.style.display =
                        "none";

                    imagePreview.innerHTML =
                        "";
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
   TEXT CLEANING
========================================================= */

function cleanMarkdownText(text) {

    if (!text) {
        return "";
    }

    return text

        /* Images */
        .replace(
            /!\[([^\]]*)\]\([^)]+\)/g,
            "$1"
        )

        /* Links */
        .replace(
            /\[([^\]]+)\]\([^)]+\)/g,
            "$1"
        )

        /* Bold */
        .replace(
            /\*\*(.*?)\*\*/g,
            "$1"
        )

        /* Italic */
        .replace(
            /__(.*?)__/g,
            "$1"
        )

        .replace(
            /\*(.*?)\*/g,
            "$1"
        )

        .replace(
            /_(.*?)_/g,
            "$1"
        )

        /* Inline code */
        .replace(
            /`([^`]+)`/g,
            "$1"
        )

        .trim();
}


/* =========================================================
   MARKDOWN PARSER
========================================================= */

/*
   Supported:

   # Main topic

   ## Primary branch

   ### Secondary branch

   - Detail

       - Nested detail

   * Detail

   + Detail

   The parser deliberately keeps the original
   Markdown hierarchy.
*/

function parseMarkdown(markdown) {

    const lines =
        markdown
            .replace(/\r\n/g, "\n")
            .split("\n");

    let rootNode = null;

    const stack = [];


    for (
        let rawLine of lines
    ) {

        if (!rawLine.trim()) {
            continue;
        }


        /*
           Normalise tabs.
        */

        const line =
            rawLine.replace(
                /\t/g,
                "    "
            );


        /* =================================================
           HEADINGS
        ================================================= */

        const headingMatch =
            line.match(
                /^\s*(#{1,6})\s+(.+?)\s*#*\s*$/
            );


        if (headingMatch) {

            const level =
                headingMatch[1].length;

            const title =
                cleanMarkdownText(
                    headingMatch[2]
                );


            const node = {

                title:
                    title,

                level:
                    level,

                type:
                    "heading",

                children:
                    [],

                collapsed:
                    false

            };


            /*
               First heading becomes root.
            */

            if (!rootNode) {

                rootNode =
                    node;

                stack.length = 0;

                stack.push(
                    node
                );

                continue;
            }


            /*
               A later H1 becomes a new root
               only if there was no usable root.
            */

            if (level === 1) {

                /*
                   Ignore additional H1s rather than
                   destroying the current tree.
                */

                continue;
            }


            /*
               Find the nearest heading above
               this heading.
            */

            while (
                stack.length > 0 &&
                stack[
                    stack.length - 1
                ].level >= level
            ) {

                stack.pop();
            }


            const parent =
                stack[
                    stack.length - 1
                ];


            if (parent) {

                parent.children.push(
                    node
                );

                stack.push(
                    node
                );
            }

            continue;
        }


        /* =================================================
           BULLETS
        ================================================= */

        const bulletMatch =
            line.match(
                /^(\s*)[-*+]\s+(.+)$/
            );


        if (bulletMatch) {

            const indentation =
                bulletMatch[1]
                    .replace(
                        /\t/g,
                        "    "
                    )
                    .length;

            const title =
                cleanMarkdownText(
                    bulletMatch[2]
                );


            const node = {

                title:
                    title,

                level:
                    null,

                type:
                    "detail",

                children:
                    [],

                collapsed:
                    false,

                indent:
                    indentation

            };


            /*
               If there is no heading yet,
               use the bullet as the root.
            */

            if (!rootNode) {

                rootNode =
                    node;

                stack.length = 0;

                stack.push(
                    node
                );

                continue;
            }


            /*
               Find the most appropriate parent.

               Bullets normally attach to the
               current heading.

               Indented bullets can attach to
               the previous bullet.
            */

            let parent =
                stack[
                    stack.length - 1
                ];


            if (
                parent &&
                parent.type === "detail" &&
                indentation <=
                    (parent.indent || 0)
            ) {

                stack.pop();

                parent =
                    stack[
                        stack.length - 1
                    ];
            }


            if (!parent) {

                parent =
                    rootNode;
            }


            parent.children.push(
                node
            );


            /*
               Keep this bullet available as a
               possible parent for nested bullets.
            */

            stack.push(
                node
            );

            continue;
        }
    }


    return rootNode;
}


/* =========================================================
   NODE DIMENSIONS
========================================================= */

function nodeWidth(d) {

    if (d.depth === 0) {
        return 300;
    }

    if (d.depth === 1) {
        return 250;
    }

    if (d.depth === 2) {
        return 215;
    }

    return 185;
}


function nodeHeight(d) {

    if (d.depth === 0) {
        return 105;
    }

    if (d.depth === 1) {
        return 68;
    }

    if (d.depth === 2) {
        return 56;
    }

    return 44;
}


/* =========================================================
   TEXT WRAPPING
========================================================= */

function wrapNodeText(
    selection,
    width
) {

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


            let characterWidth;


            if (d.depth === 0) {

                characterWidth = 12;

            } else if (d.depth === 1) {

                characterWidth = 8.5;

            } else {

                characterWidth = 7;
            }


            while (
                (word = words.pop())
            ) {

                line.push(
                    word
                );


                const test =
                    line.join(" ");


                const estimatedWidth =
                    test.length *
                    characterWidth;


                if (
                    estimatedWidth > width &&
                    line.length > 1
                ) {

                    line.pop();

                    lines.push(
                        line.join(" ")
                    );

                    line = [
                        word
                    ];
                }
            }


            if (line.length) {

                lines.push(
                    line.join(" ")
                );
            }


            const lineHeight =
                d.depth === 0
                    ? 25
                    : d.depth === 1
                        ? 19
                        : 16;


            const totalHeight =
                (
                    lines.length - 1
                ) *
                lineHeight;


            text.text("");


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
   SUBTREE HEIGHT
========================================================= */

/*
   Instead of relying entirely on d3.tree(),
   we calculate how much vertical space each
   subtree needs.

   This is the key change in this version.
*/

function calculateSubtreeHeight(
    node,
    depth
) {

    if (
        !node.children ||
        node.children.length === 0
    ) {

        return nodeHeight({
            depth:
                depth
        });
    }


    const childGap =
        depth === 0
            ? 46
            : depth === 1
                ? 32
                : 24;


    let total =
        0;


    node.children.forEach(
        function (child) {

            total +=
                calculateSubtreeHeight(
                    child,
                    depth + 1
                );
        }
    );


    total +=
        childGap *
        (
            node.children.length - 1
        );


    const ownHeight =
        nodeHeight({
            depth:
                depth
        });


    return Math.max(
        total,
        ownHeight
    );
}


/* =========================================================
   HIERARCHY POSITIONING
========================================================= */

/*
   Position a subtree.

   x = vertical position
   y = horizontal depth

   The important point is that the root
   is ALWAYS x = 0.

   We never recalculate the root's screen
   position during expansion.
*/

function positionSubtree(
    node,
    centerX
) {

    node.x =
        centerX;


    if (
        !node.children ||
        node.children.length === 0
    ) {

        return;
    }


    const childGap =
        node.depth === 0
            ? 46
            : node.depth === 1
                ? 30
                : 22;


    const childHeights =
        node.children.map(
            function (child) {

                return calculateSubtreeHeight(
                    child,
                    child.depth
                );
            }
        );


    const totalHeight =
        childHeights.reduce(
            function (
                total,
                value
            ) {

                return total + value;

            },
            0
        ) +
        childGap *
        (
            node.children.length - 1
        );


    let cursor =
        centerX -
        totalHeight / 2;


    node.children.forEach(
        function (
            child,
            index
        ) {

            const height =
                childHeights[index];


            const childCenter =
                cursor +
                height / 2;


            positionSubtree(
                child,
                childCenter
            );


            cursor +=
                height +
                childGap;
        }
    );
}


/* =========================================================
   BUILD LAYOUT
========================================================= */

function buildLayout(
    hierarchyRoot
) {

    /*
       Horizontal spacing between generations.
    */

    const depthSpacing = {
        0: 0,
        1: 350,
        2: 300,
        3: 255,
        4: 220,
        5: 200
    };


    hierarchyRoot.each(
        function (d) {

            d.y =
                depthSpacing[d.depth] ||
                (
                    350 +
                    (
                        d.depth -
                        1
                    ) *
                    220
                );
        }
    );


    /*
       Root is the fixed anchor.
    */

    hierarchyRoot.x =
        ROOT_LOGICAL_X;


    /*
       Position every first-level subtree
       around the root.

       The root itself NEVER moves.
    */

    if (
        hierarchyRoot.children &&
        hierarchyRoot.children.length
    ) {

        const children =
            hierarchyRoot.children;


        const gap =
            55;


        const heights =
            children.map(
                function (child) {

                    return calculateSubtreeHeight(
                        child,
                        1
                    );
                }
            );


        const total =
            heights.reduce(
                function (
                    total,
                    value
                ) {

                    return total + value;

                },
                0
            ) +
            gap *
            (
                children.length - 1
            );


        let cursor =
            -total / 2;


        children.forEach(
            function (
                child,
                index
            ) {

                const height =
                    heights[index];


                const center =
                    cursor +
                    height / 2;


                positionSubtree(
                    child,
                    center
                );


                cursor +=
                    height +
                    gap;
            }
        );
    }
}


/* =========================================================
   LINK PATH
========================================================= */

function createLinkPath(d) {

    const sourceRight =
        d.source.y +
        nodeWidth(d.source) /
        2;


    const targetLeft =
        d.target.y -
        nodeWidth(d.target) /
        2;


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
   RENDER
========================================================= */

function renderMindMap(
    tree,
    fitAfterRender = false
) {

    if (!tree) {
        return;
    }


    /*
       Save the current camera BEFORE
       destroying the old SVG contents.
    */

    const previousTransform =
        d3.zoomTransform(
            svg.node()
        );


    svg.selectAll("*")
        .remove();


    currentTree =
        tree;


    /* =====================================================
       CONTAINER
    ===================================================== */

    const container =
        svg
            .append("g")
            .attr(
                "class",
                "map-container"
            );


    /* =====================================================
       ZOOM
    ===================================================== */

    zoomBehaviour =
        d3.zoom()

            .scaleExtent([
                0.30,
                3
            ])

            .on(
                "zoom",
                function (event) {

                    container.attr(
                        "transform",
                        event.transform
                    );
                }
            );


    svg.call(
        zoomBehaviour
    );


    /* =====================================================
       HIERARCHY
    ===================================================== */

    root =
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


    /* =====================================================
       STABLE LAYOUT
    ===================================================== */

    buildLayout(
        root
    );


    /* =====================================================
       LINKS
    ===================================================== */

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
            root.links()
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

                    return 2.4;
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


    /* =====================================================
       NODE GROUP
    ===================================================== */

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
                root.descendants()
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


    /* =====================================================
       NODE CARDS
    ===================================================== */

    nodes

        .append("rect")

        .attr(
            "class",
            "node-card"
        )

        .attr(
            "x",
            function (d) {

                return -
                    nodeWidth(d) /
                    2;
            }
        )

        .attr(
            "y",
            function (d) {

                return -
                    nodeHeight(d) /
                    2;
            }
        )

        .attr(
            "width",
            function (d) {

                return nodeWidth(d);
            }
        )

        .attr(
            "height",
            function (d) {

                return nodeHeight(d);
            }
        )

        .attr(
            "rx",
            function (d) {

                return d.depth === 0
                    ? 20
                    : 14;
            }
        )

        .attr(
            "ry",
            function (d) {

                return d.depth === 0
                    ? 20
                    : 14;
            }
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

                    return branchColor(
                        d
                    );
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


    /* =====================================================
       PRIMARY ACCENT
    ===================================================== */

    nodes

        .filter(
            function (d) {

                return (
                    d.depth === 1
                );
            }
        )

        .append("rect")

        .attr(
            "class",
            "node-accent"
        )

        .attr(
            "x",
            function (d) {

                return -
                    nodeWidth(d) /
                    2;
            }
        )

        .attr(
            "y",
            function (d) {

                return -
                    nodeHeight(d) /
                    2;
            }
        )

        .attr(
            "width",
            7
        )

        .attr(
            "height",
            function (d) {

                return nodeHeight(d);
            }
        )

        .attr(
            "rx",
            3
        )

        .attr(
            "fill",
            function (d) {

                return branchColor(
                    d
                );
            }
        );


    /* =====================================================
       TEXT
    ===================================================== */

    const nodeText =
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
                function (d) {

                    return d.depth <= 1
                        ? 700
                        : 400;
                }
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


    wrapNodeText(
        nodeText,
        200
    );


    /* =====================================================
       EXPANDABLE NODES
    ===================================================== */

    const expandable =
        nodes.filter(
            function (d) {

                return (
                    d.data.children &&
                    d.data.children.length > 0
                );
            }
        );


    /* =====================================================
       EXPAND CIRCLE
    ===================================================== */

    expandable

        .append("circle")

        .attr(
            "class",
            "expand-button"
        )

        .attr(
            "cx",
            function (d) {

                return (
                    nodeWidth(d) /
                    2 -
                    18
                );
            }
        )

        .attr(
            "cy",
            function (d) {

                return (
                    -
                    nodeHeight(d) /
                    2 +
                    18
                );
            }
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
            function (d) {

                return branchColor(
                    d
                );
            }
        )

        .attr(
            "stroke-width",
            2
        );


    /* =====================================================
       PLUS / MINUS SYMBOL
    ===================================================== */

    expandable

        .append("text")

        .attr(
            "class",
            "expand-symbol"
        )

        .attr(
            "x",
            function (d) {

                return (
                    nodeWidth(d) /
                    2 -
                    18
                );
            }
        )

        .attr(
            "y",
            function (d) {

                return (
                    -
                    nodeHeight(d) /
                    2 +
                    19
                );
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
            "13px"
        )

        .attr(
            "font-weight",
            "700"
        )

        .attr(
            "fill",
            function (d) {

                return branchColor(
                    d
                );
            }
        )

        .text(
            function (d) {

                return d.data.collapsed
                    ? "+"
                    : "−";
            }
        );


    /* =====================================================
       ROOT IMAGE
    ===================================================== */

    if (
        currentImage
    ) {

        const rootNode =
            nodes.filter(
                function (d) {

                    return (
                        d.depth === 0
                    );
                }
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
                -
                    nodeWidth(root) /
                    2 +
                    14
            )

            .attr(
                "y",
                -
                    nodeHeight(root) /
                    2 +
                    14
            )

            .attr(
                "width",
                70
            )

            .attr(
                "height",
                nodeHeight(root) -
                    28
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
                -
                    nodeWidth(root) /
                    2 +
                    14
            )

            .attr(
                "y",
                -
                    nodeHeight(root) /
                    2 +
                    14
            )

            .attr(
                "width",
                70
            )

            .attr(
                "height",
                nodeHeight(root) -
                    28
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


    /* =====================================================
       EXPAND / COLLAPSE
    ===================================================== */

    expandable.on(
        "click",
        function (
            event,
            d
        ) {

            event.stopPropagation();


            d.data.collapsed =
                !d.data.collapsed;


            /*
               CRITICAL:

               We re-render WITHOUT fitting.

               The previous camera is restored,
               so the map does not jump to another
               part of the screen.
            */

            renderMindMap(
                tree,
                false
            );
        }
    );


    /* =====================================================
       RESTORE CAMERA
    ===================================================== */

    if (
        !fitAfterRender
    ) {

        svg.call(
            zoomBehaviour.transform,
            previousTransform
        );
    }


    /* =====================================================
       INITIAL FIT ONLY
    ===================================================== */

    if (
        fitAfterRender
    ) {

        setTimeout(
            function () {

                fitMap();

            },
            80
        );
    }
}


/* =========================================================
   FIT MAP
========================================================= */

function fitMap() {

    if (!root) {
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


    /*
       Root's logical position is always 0.
    */

    const rootX =
        ROOT_LOGICAL_X;


    const left =
        Math.abs(
            Math.min(
                bounds.x,
                rootX -
                    nodeWidth(root) /
                    2
            )
        );


    const right =
        Math.max(
            bounds.x +
                bounds.width,
            rootX +
                nodeWidth(root) /
                2
        );


    const totalWidth =
        left +
        right;


    const totalHeight =
        bounds.height;


    let scaleX =
        (
            width *
            0.90
        ) /
        (
            totalWidth +
            40
        );


    let scaleY =
        (
            height *
            0.90
        ) /
        (
            totalHeight +
            40
        );


    let scale =
        Math.min(
            scaleX,
            scaleY
        );


    scale =
        Math.max(
            0.35,
            scale
        );


    scale =
        Math.min(
            1.15,
            scale
        );


    /*
       Put the root approximately 25% from
       the left edge.

       This gives the branches room to grow
       to the right.
    */

    const desiredRootX =
        width *
        0.25;


    const desiredRootY =
        height *
        0.50;


    const translateX =
        desiredRootX;


    const translateY =
        desiredRootY;


    svg.transition()

        .duration(450)

        .call(
            zoomBehaviour.transform,

            d3.zoomIdentity

                .translate(
                    translateX,
                    translateY
                )

                .scale(
                    scale
                )
        );
}


/* =========================================================
   ZOOM IN
========================================================= */

if (
    zoomInButton
) {

    zoomInButton.addEventListener(
        "click",
        function () {

            if (
                !zoomBehaviour
            ) {

                return;
            }


            svg.transition()

                .duration(250)

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

if (
    zoomOutButton
) {

    zoomOutButton.addEventListener(
        "click",
        function () {

            if (
                !zoomBehaviour
            ) {

                return;
            }


            svg.transition()

                .duration(250)

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

if (
    fitButton
) {

    fitButton.addEventListener(
        "click",
        function () {

            fitMap();
        }
    );
}


/* =========================================================
   GENERATE
========================================================= */

if (
    generateButton
) {

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


            currentTree =
                tree;


            /*
               Switch from input screen
               to map screen.
            */

            if (
                inputPanel
            ) {

                inputPanel.classList.add(
                    "hidden"
                );
            }


            if (
                mapPanel
            ) {

                mapPanel.classList.remove(
                    "hidden"
                );
            }


            renderMindMap(
                tree,
                true
            );
        }
    );
}


/* =========================================================
   WINDOW RESIZE
========================================================= */

/*
   Do NOT automatically fit on resize.

   That would move the map while the user
   is working with it.

   Instead we simply redraw using the current
   camera position.
*/

window.addEventListener(
    "resize",
    function () {

        if (
            currentTree &&
            zoomBehaviour
        ) {

            const transform =
                d3.zoomTransform(
                    svg.node()
                );


            renderMindMap(
                currentTree,
                false
            );


            /*
               renderMindMap already restores
               the transform.
            */

            svg.call(
                zoomBehaviour.transform,
                transform
            );
        }
    }
);


/* =========================================================
   END
========================================================= */
