/* =========================================================
   MIND MAP GENERATOR
   Version 6 — Subtree Layout Engine
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

let root = null;

let zoomBehaviour = null;

let currentImage = null;


/* =========================================================
   IMAGE HANDLING
========================================================= */

imageInput.addEventListener(
    "change",
    function () {

        const file =
            this.files[0];

        if (!file) {

            currentImage = null;

            imagePreview.style.display =
                "none";

            imagePreview.innerHTML =
                "";

            return;
        }

        const reader =
            new FileReader();

        reader.onload =
            function (event) {

                currentImage =
                    event.target.result;

                imagePreview.innerHTML =
                    `<img src="${currentImage}" alt="Map image">`;

                imagePreview.style.display =
                    "block";
            };

        reader.readAsDataURL(file);
    }
);


/* =========================================================
   MARKDOWN PARSER
========================================================= */

function parseMarkdown(markdown) {

    const lines =
        markdown
            .replace(/\r\n/g, "\n")
            .split("\n");

    let root =
        null;

    const stack =
        [];


    for (
        let rawLine of lines
    ) {

        const line =
            rawLine.replace(
                /\t/g,
                "    "
            );


        if (!line.trim()) {
            continue;
        }


        /* =================================================
           HEADINGS
        ================================================= */

        const headingMatch =
            line.match(
                /^(#{1,6})\s+(.+)$/
            );


        if (headingMatch) {

            const level =
                headingMatch[1].length;

            const title =
                headingMatch[2].trim();


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


            /* ---------------------------------------------
               ROOT
            --------------------------------------------- */

            if (
                level === 1 ||
                !root
            ) {

                if (!root) {

                    root =
                        node;
                }

                stack.length =
                    0;

                stack.push(
                    node
                );

                continue;
            }


            /* ---------------------------------------------
               FIND PARENT
            --------------------------------------------- */

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
                /^\s*[-*+]\s+(.+)$/
            );


        if (bulletMatch) {

            const node = {

                title:
                    bulletMatch[1].trim(),

                level:
                    null,

                type:
                    "detail",

                children:
                    [],

                collapsed:
                    false
            };


            const parent =
                stack[
                    stack.length - 1
                ];


            if (parent) {

                parent.children.push(
                    node
                );
            }
        }
    }


    return root;
}


/* =========================================================
   BRANCH COLORS
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
   NODE WIDTH
========================================================= */

function nodeWidth(d) {

    if (d.depth === 0) {

        return 300;
    }


    if (d.depth === 1) {

        return 270;
    }


    if (d.depth === 2) {

        return 225;
    }


    return 200;
}


/* =========================================================
   NODE HEIGHT
========================================================= */

function nodeHeight(d) {

    if (d.depth === 0) {

        return 110;
    }


    if (d.depth === 1) {

        return 72;
    }


    if (d.depth === 2) {

        return 58;
    }


    return 48;
}


/* =========================================================
   HORIZONTAL POSITIONS
========================================================= */

function nodeXPosition(depth) {

    /*
       D3's "y" represents horizontal position.

       These distances are deliberately generous so
       cards cannot overlap horizontally.
    */

    if (depth === 0) {

        return 0;
    }


    if (depth === 1) {

        return 350;
    }


    if (depth === 2) {

        return 650;
    }


    if (depth === 3) {

        return 930;
    }


    return (
        930 +
        (
            depth - 3
        ) *
        250
    );
}


/* =========================================================
   VERTICAL SPACING
========================================================= */

function verticalGap(depth) {

    if (depth === 0) {

        return 70;
    }


    if (depth === 1) {

        return 55;
    }


    if (depth === 2) {

        return 38;
    }


    return 28;
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

            const lineHeight =
                d.depth === 0
                    ? 25
                    : d.depth === 1
                        ? 19
                        : 16;


            const lines =
                [];


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
                    (
                        d.depth === 0
                            ? 12
                            : d.depth === 1
                                ? 8.5
                                : 7
                    );


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


            const totalHeight =
                (
                    lines.length - 1
                ) *
                lineHeight;


            text.text(
                null
            );


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
   SUBTREE SIZE CALCULATION
========================================================= */

/*
   This is the main new layout engine.

   Instead of saying:

       "Every node is 115px apart"

   we calculate:

       "How much vertical space does this entire
        branch require?"

   A branch with many children therefore gets more
   room automatically.
*/

function calculateSubtreeHeight(
    node
) {

    const ownHeight =
        nodeHeight(node);


    /*
       If this node is collapsed, its subtree is
       just the node itself.
    */

    if (
        node.data.collapsed ||
        !node.children ||
        node.children.length === 0
    ) {

        node._subtreeHeight =
            ownHeight;

        return ownHeight;
    }


    let childrenHeight =
        0;


    node.children.forEach(
        function (child) {

            childrenHeight +=
                calculateSubtreeHeight(
                    child
                );
        }
    );


    const gaps =
        (
            node.children.length - 1
        ) *
        verticalGap(
            node.depth
        );


    childrenHeight +=
        gaps;


    node._subtreeHeight =
        Math.max(
            ownHeight,
            childrenHeight
        );


    return node._subtreeHeight;
}


/* =========================================================
   SUBTREE POSITIONING
========================================================= */

function positionSubtree(
    node,
    centreY
) {

    /*
       The node itself is placed at centreY.
    */

    node.x =
        centreY;


    node.y =
        nodeXPosition(
            node.depth
        );


    if (
        node.data.collapsed ||
        !node.children ||
        node.children.length === 0
    ) {

        return;
    }


    /* ---------------------------------------------
       Total required height of children
    --------------------------------------------- */

    let totalChildrenHeight =
        0;


    node.children.forEach(
        function (child) {

            totalChildrenHeight +=
                child._subtreeHeight;
        }
    );


    totalChildrenHeight +=
        (
            node.children.length - 1
        ) *
        verticalGap(
            node.depth
        );


    /*
       Start the first child so the complete group
       is centred around the parent.
    */

    let cursor =
        centreY -
        totalChildrenHeight /
        2;


    node.children.forEach(
        function (child) {

            const childCentre =
                cursor +
                child._subtreeHeight /
                2;


            positionSubtree(
                child,
                childCentre
            );


            cursor +=
                child._subtreeHeight +
                verticalGap(
                    node.depth
                );
        }
    );
}


/* =========================================================
   ROOT / PRIMARY BRANCH LAYOUT
========================================================= */

/*
   The normal recursive layout above is good for the
   interior of a branch.

   The root needs special treatment.

   We want:

        ROOT
          \
           PRIMARY
              \
               SECONDARY
                    \
                     DETAILS

   and NOT the primary cards sitting on top of ROOT.
*/

function createStructuredLayout(
    root
) {

    calculateSubtreeHeight(
        root
    );


    root.x =
        0;

    root.y =
        nodeXPosition(0);


    if (
        !root.children ||
        root.children.length === 0
    ) {

        return;
    }


    const children =
        root.children;


    let totalHeight =
        0;


    children.forEach(
        function (child) {

            totalHeight +=
                child._subtreeHeight;
        }
    );


    totalHeight +=
        (
            children.length - 1
        ) *
        verticalGap(0);


    /*
       Centre all primary branches around
       the root.
    */

    let cursor =
        -
        totalHeight /
        2;


    children.forEach(
        function (child) {

            const centre =
                cursor +
                child._subtreeHeight /
                2;


            positionSubtree(
                child,
                centre
            );


            cursor +=
                child._subtreeHeight +
                verticalGap(0);
        }
    );


    /*
       The first-level branches should never be
       allowed to overlap the root vertically.

       If necessary, move the entire primary branch
       down/up as a complete unit.
    */

    const minimumRootGap =
        35;


    children.forEach(
        function (child) {

            const rootHalf =
                nodeHeight(root) /
                2;


            const childHalf =
                nodeHeight(child) /
                2;


            const distance =
                Math.abs(
                    child.x -
                    root.x
                );


            const minimumDistance =
                rootHalf +
                childHalf +
                minimumRootGap;


            if (
                distance <
                minimumDistance
            ) {

                const direction =
                    child.x >= root.x
                        ? 1
                        : -1;


                const adjustment =
                    (
                        minimumDistance -
                        distance
                    ) *
                    direction;


                child.each(
                    function (d) {

                        d.x +=
                            adjustment;
                    }
                );
            }
        }
    );


    /*
       Recalculate the visual centre of the
       primary group.

       We do this without moving the root.
    */

    const top =
        Math.min(
            ...children.map(
                function (d) {

                    return (
                        d.x -
                        d._subtreeHeight /
                        2
                    );
                }
            )
        );


    const bottom =
        Math.max(
            ...children.map(
                function (d) {

                    return (
                        d.x +
                        d._subtreeHeight /
                        2
                    );
                }
            )
        );


    const groupCentre =
        (
            top +
            bottom
        ) / 2;


    /*
       Only make a small correction.

       The root remains at EXACTLY x = 0.
    */

    const correction =
        -groupCentre;


    children.forEach(
        function (child) {

            child.each(
                function (d) {

                    d.x +=
                        correction;
                }
            );
        }
    );
}


/* =========================================================
   LINK PATH
========================================================= */

function createLinkPath(d) {

    const sourceRight =
        d.source.y +
        nodeWidth(
            d.source
        ) /
        2;


    const targetLeft =
        d.target.y -
        nodeWidth(
            d.target
        ) /
        2;


    const x1 =
        sourceRight;


    const x2 =
        targetLeft;


    const middle =
        (
            x1 +
            x2
        ) / 2;


    return `
        M ${x1},${d.source.x}
        C ${middle},${d.source.x}
          ${middle},${d.target.x}
          ${x2},${d.target.x}
    `;
}


/* =========================================================
   RENDER MIND MAP
========================================================= */

function renderMindMap(
    tree,
    fitAfterRender = false
) {

    /*
       Preserve the camera when expanding/collapsing.
    */

    const previousTransform =
        d3.zoomTransform(
            svg.node()
        );


    svg.selectAll("*")
        .remove();


    if (!tree) {

        return;
    }


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
                0.35,
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
       STRUCTURED LAYOUT
    ===================================================== */

    createStructuredLayout(
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


    /* =====================================================
       NODES
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
       NODE CARD
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
       PRIMARY COLOUR ACCENT
    ===================================================== */

    nodes

        .filter(
            function (d) {

                return d.depth === 1;
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
       PLUS / MINUS
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

    if (currentImage) {

        const rootNode =
            nodes.filter(
                function (d) {

                    return d.depth === 0;
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
       EXPAND / COLLAPSE CLICK
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


            renderMindMap(
                tree,
                false
            );
        }
    );


    /* =====================================================
       RESTORE CAMERA
    ===================================================== */

    if (!fitAfterRender) {

        svg.call(
            zoomBehaviour.transform,
            previousTransform
        );
    }


    /* =====================================================
       INITIAL FIT
    ===================================================== */

    if (
        fitAfterRender
    ) {

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
       The root is always the anchor.

       We deliberately do NOT centre the complete
       bounding box because that makes the root
       jump around.
    */

    const rootX =
        root.y;


    const leftSpace =
        rootX -
        bounds.x;


    const rightSpace =
        bounds.x +
        bounds.width -
        rootX;


    const horizontalScale =
        (
            width *
            0.90
        ) /
        (
            leftSpace +
            rightSpace +
            100
        );


    const verticalScale =
        (
            height *
            0.90
        ) /
        (
            bounds.height +
            80
        );


    let scale =
        Math.min(
            horizontalScale,
            verticalScale
        );


    scale =
        Math.max(
            scale,
            0.55
        );


    scale =
        Math.min(
            scale,
            1.15
        );


    /*
       Root sits about 25% from the left.
    */

    const desiredRootX =
        width *
        0.25;


    const desiredRootY =
        height *
        0.50;


    const translateX =
        desiredRootX -
        (
            rootX *
            scale
        );


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

document
    .getElementById(
        "zoomInButton"
    )
    .addEventListener(
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


/* =========================================================
   ZOOM OUT
========================================================= */

document
    .getElementById(
        "zoomOutButton"
    )
    .addEventListener(
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


/* =========================================================
   FIT BUTTON
========================================================= */

document
    .getElementById(
        "fitButton"
    )
    .addEventListener(
        "click",
        function () {

            fitMap();
        }
    );


/* =========================================================
   GENERATE
========================================================= */

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


        inputPanel.classList.add(
            "hidden"
        );


        mapPanel.classList.remove(
            "hidden"
        );


        renderMindMap(
            tree,
            true
        );
    }
);
